// Bumper Arena party rooms: 2–4 friends over a WebSocket to the room server (apps/realtime,
// BumperRoom). The connection itself is lib/realtimeRoom.ts; this adds the match: its messages
// and results. The room runs the physics; net.ts draws its snapshots.
import { BUMPER_PROTOCOL_VERSION, type BumperClientMessage, type BumperPeek, type BumperServerMessage, type BumperSettings, type BumperStanding, type BumperView, type BumperXpGain } from "@shadow/shared";
import { track } from "../../lib/analytics";
import { createRoomClient, type CoreRoomState, type Who } from "../../lib/realtimeRoom";

export { roomsAvailable, type RoomError } from "../../lib/realtimeRoom";

/** `xp`: what the last match earned us (undefined until the room hears from the API; null if it couldn't be saved). */
export type BumperRoomState = CoreRoomState<BumperView> & { standings: BumperStanding[] | null; xp: BumperXpGain | null | undefined };

type Listener = (msg: BumperServerMessage) => void;
const listeners = new Set<Listener>();

/** The room's status when we last heard, to spot a match starting (for analytics). */
let lastStatus: BumperView["status"] | null = null;

const client = createRoomClient<BumperView, { standings: BumperStanding[] | null; xp: BumperXpGain | null | undefined }, BumperServerMessage>({
  path: "/bumper/rooms",
  protocolVersion: BUMPER_PROTOCOL_VERSION,
  clientKey: "bumper-arena:room-client",
  extra: { standings: null, xp: undefined },
  onMessage(msg, room) {
    switch (msg.type) {
      // Results stay on screen only while the room is showing them.
      case "welcome":
      case "room":
        room.update(msg.room.status === "results" ? {} : { standings: null, xp: undefined });
        if (lastStatus === "lobby" && msg.room.status === "round") {
          track("game_started", { game: "bumper-arena", mode: "party", players: msg.room.entrants.length, rounds: msg.room.rounds, map: msg.room.settings.map });
        }
        lastStatus = msg.room.status;
        break;
      case "results": {
        room.update({ standings: msg.standings });
        const mine = msg.standings.find((s) => s.id === room.state().you);
        track("game_finished", { game: "bumper-arena", mode: "party", players: msg.standings.length, place: mine?.place ?? null, score: mine?.score ?? 0 });
        break;
      }
      case "xp":
        room.update({ xp: msg.gain });
        break;
    }
    for (const l of listeners) l(msg);
  },
});

export const useBumperRoom = (): BumperRoomState => client.useRoom();
export const bumperRoomState = (): BumperRoomState => client.state();
/** Called on every change to the room's state. */
export const onBumperRoomChange = (l: () => void) => client.subscribe(l);

/** Every message from the room, as it arrives (snapshots, for net.ts). */
export function onBumperMessage(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Makes a room; resolves to its code, or null if the server couldn't. */
export const createBumperRoom = async () => {
  const code = await client.create();
  if (code) track("room_created", { game: "bumper-arena" });
  return code;
};
export const peekBumperRoom = (code: string) => client.peek(code) as Promise<BumperPeek | null>;
export const joinBumperRoom = (code: string, as: Who) => {
  track("room_joined", { game: "bumper-arena" });
  lastStatus = null;
  client.join(code, as);
};
export const leaveBumperRoom = () => client.leave();

/** Any message to the room (dropped if we're not connected). */
export const sendBumper = (msg: BumperClientMessage) => client.send(msg);
export const setBumperReady = (on: boolean) => sendBumper({ type: "ready", on });
export const setBumperSettings = (settings: BumperSettings) => sendBumper({ type: "settings", settings });
export const startBumper = () => sendBumper({ type: "start" });
export const bumperRematch = () => sendBumper({ type: "rematch" });

/** A server time (a phase's end) on this browser's clock. */
export const toLocalTime = (serverMs: number) => client.toLocalTime(serverMs);
