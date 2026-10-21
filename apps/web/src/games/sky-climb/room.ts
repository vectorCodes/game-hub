// Rooms: 1–3 friends racing the same tower, over a WebSocket to the room server
// (apps/realtime). The connection itself is lib/realtimeRoom.ts; this adds the race: its
// messages, the results, and the other racers' positions. See Multiplayer.md.
import { useSyncExternalStore } from "react";
import {
  ROOM_POS_HZ,
  ROOM_PROTOCOL_VERSION,
  type GhostFrame,
  type RoomClientMessage,
  type RoomPeek,
  type RoomServerMessage,
  type RoomStanding,
  type RoomView,
} from "@shadow/shared";
import { track } from "../../lib/analytics";
import { createRoomClient, type CoreRoomState, type Who } from "../../lib/realtimeRoom";
import { packFrame, pushPacked, sampleLive, type LiveRider } from "./live";

export { roomsAvailable, type RoomError } from "../../lib/realtimeRoom";

export type RoomState = CoreRoomState<RoomView> & { standings: RoomStanding[] | null };

const client = createRoomClient<RoomView, { standings: RoomStanding[] | null }, RoomServerMessage>({
  path: "/rooms",
  protocolVersion: ROOM_PROTOCOL_VERSION,
  clientKey: "sky-climb:room-client",
  extra: { standings: null },
  onMessage(msg, room) {
    switch (msg.type) {
      // Results stay on screen only while the room is showing them.
      case "welcome":
      case "room":
        room.update({ standings: msg.room.status === "results" ? room.state().standings : null });
        break;
      case "results":
        room.update({ standings: msg.standings });
        break;
      case "pos": {
        const rival = rivals.get(msg.id);
        if (rival) pushPacked(rival, msg.p);
        break;
      }
    }
  },
  onUpdate: (state) => syncRivals(state.room, state.you),
});

export const useRoom = (): RoomState => client.useRoom();
export const roomState = (): RoomState => client.state();

/** Makes a room; resolves to its code, or null if the server couldn't. */
export const createRoom = async () => {
  const code = await client.create();
  if (code) track("room_created", { game: "sky-climb" });
  return code;
};
export const peekRoom = (code: string) => client.peek(code) as Promise<RoomPeek | null>;
export const joinRoom = (code: string, as: Who) => {
  track("room_joined", { game: "sky-climb" });
  client.join(code, as);
};
export const leaveRoom = () => client.leave();
export const clearRoomError = () => client.clearError();

const send = (msg: RoomClientMessage) => client.send(msg);
export const setReady = (on: boolean) => send({ type: "ready", on });
export const startRace = () => send({ type: "start" });
export const rematch = () => send({ type: "rematch" });
export const sendRoomProgress = (floor: number) => send({ type: "progress", floor });
export const sendRoomFinish = () => send({ type: "finish" });
export const sendRoomPos = (f: GhostFrame) => send({ type: "pos", p: packFrame(f) });
/** Seconds between position sends. */
export const ROOM_SEND_EVERY = 1 / ROOM_POS_HZ;

/** A server time (the race's start or end) on this browser's clock. */
export const toLocalTime = (serverMs: number) => client.toLocalTime(serverMs);

// ---------- The other racers ----------

/** Drawn this far behind, so there are two positions (sent 10 a second) to blend. */
const RIVAL_DELAY_MS = 220;
const rivals = new Map<string, LiveRider>();
let rivalList: LiveRider[] = [];

/** The other players in the room, with their latest positions. */
export function useRoomRivals(): LiveRider[] {
  return useSyncExternalStore(client.subscribe, () => rivalList);
}

export const sampleRival = (rival: LiveRider, out: GhostFrame) => sampleLive(rival, out, RIVAL_DELAY_MS);

/** Keeps a rider per other player, named and dressed as the room says. */
function syncRivals(room: RoomView | null, you: string | null) {
  const present = new Set(room?.players.filter((p) => p.id !== you && !p.dnf).map((p) => p.id));
  let changed = false;
  for (const id of rivals.keys()) {
    if (!present.has(id)) {
      rivals.delete(id);
      changed = true;
    }
  }
  for (const p of room?.players ?? []) {
    if (!present.has(p.id)) continue;
    const rival = rivals.get(p.id);
    if (!rival) {
      rivals.set(p.id, { id: p.id, name: p.name, avatar: p.avatar, buffer: [] });
      changed = true;
    } else if (rival.name !== p.name || rival.avatar !== p.avatar) {
      Object.assign(rival, { name: p.name, avatar: p.avatar });
      changed = true;
    }
  }
  if (changed) rivalList = [...rivals.values()];
}
