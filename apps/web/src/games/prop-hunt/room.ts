// Prop Hunt rooms: 2–8 friends over a WebSocket to the room server (apps/realtime, HuntRoom).
// The connection itself is lib/realtimeRoom.ts; this adds the match: its messages and results.
// The server decides roles, phases, disguises and zaps; this keeps its latest word.
import { HUNT_PROTOCOL_VERSION, type HuntClientMessage, type HuntPeek, type HuntServerMessage, type HuntStanding, type HuntView } from "@shadow/shared";
import { track } from "../../lib/analytics";
import { createRoomClient, type CoreRoomState, type Who } from "../../lib/realtimeRoom";

export { roomsAvailable, type RoomError } from "../../lib/realtimeRoom";

export type HuntRoomState = CoreRoomState<HuntView> & { standings: HuntStanding[] | null };

type Listener = (msg: HuntServerMessage) => void;
const listeners = new Set<Listener>();

/** The room's status when we last heard, to spot a match starting (for analytics). */
let lastStatus: HuntView["status"] | null = null;

const client = createRoomClient<HuntView, { standings: HuntStanding[] | null }, HuntServerMessage>({
  path: "/hunt/rooms",
  protocolVersion: HUNT_PROTOCOL_VERSION,
  clientKey: "prop-hunt:room-client",
  extra: { standings: null },
  onMessage(msg, room) {
    switch (msg.type) {
      // Results stay on screen only while the room is showing them.
      case "welcome":
      case "room":
        room.update({ standings: msg.room.status === "results" ? room.state().standings : null });
        if (lastStatus === "lobby" && msg.room.status !== "lobby") {
          track("game_started", { game: "prop-hunt", mode: "friends", players: msg.room.players.length, rounds: msg.room.rounds });
        }
        lastStatus = msg.room.status;
        break;
      case "results": {
        room.update({ standings: msg.standings });
        const mine = msg.standings.find((s) => s.id === room.state().you);
        track("game_finished", { game: "prop-hunt", mode: "friends", players: msg.standings.length, place: mine?.place ?? null, score: mine?.score ?? 0 });
        break;
      }
    }
    for (const l of listeners) l(msg);
  },
});

export const useHuntRoom = (): HuntRoomState => client.useRoom();
export const huntRoomState = (): HuntRoomState => client.state();

/** Every message from the room, as it arrives (positions, disguises, zaps… for the scene). */
export function onHuntMessage(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Makes a room; resolves to its code, or null if the server couldn't. */
export const createHuntRoom = async () => {
  const code = await client.create();
  if (code) track("room_created", { game: "prop-hunt" });
  return code;
};
export const peekHuntRoom = (code: string) => client.peek(code) as Promise<HuntPeek | null>;
export const joinHuntRoom = (code: string, as: Who) => {
  track("room_joined", { game: "prop-hunt" });
  lastStatus = null;
  client.join(code, as);
};
export const leaveHuntRoom = () => client.leave();
export const clearHuntRoomError = () => client.clearError();

/** Any message to the room (dropped if we're not connected). */
export const sendHunt = (msg: HuntClientMessage) => client.send(msg);
const send = sendHunt;
export const setHuntReady = (on: boolean) => send({ type: "ready", on });
export const startHunt = () => send({ type: "start" });
export const huntRematch = () => send({ type: "rematch" });

/** A server time (a phase's end) on this browser's clock. */
export const toLocalTime = (serverMs: number) => client.toLocalTime(serverMs);
