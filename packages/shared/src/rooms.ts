import { z } from "zod";
import { AvatarConfig } from "./avatar";

// What every game's rooms have in common (Sky Climb races, Prop Hunt matches): codes, joining
// and leaving, the clock, and errors. Each game adds its own messages on top. A room lives in a
// Cloudflare Durable Object (apps/realtime); see Multiplayer.md.

/** A dropped player keeps their slot this long. */
export const ROOM_GRACE_MS = 15_000;

/** No 0/O, 1/I/L: codes are read aloud and typed from screenshots. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

/** A typed code, uppercased and trimmed; null if it can't be a room code. */
export function normalizeRoomCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** The first message on a socket: who's joining. */
export const RoomHello = z.object({
  type: z.literal("hello"),
  /** The game's protocol version: older tabs are told to reload. */
  v: z.int(),
  /** Supabase access token; absent for guests. Sent here rather than in the URL so it isn't logged. */
  token: z.string().max(4096).optional(),
  /** This browser's id: a guest gets their slot back with it after a dropped connection. */
  clientId: z.string().min(8).max(64),
  name: z.string().max(40),
  avatar: AvatarConfig.nullable(),
});
export const RoomPing = z.object({ type: z.literal("ping"), t: z.number() });
export const RoomLeave = z.object({ type: z.literal("leave") });

/** The messages every room understands, whatever the game. */
export type CoreClientMessage = z.infer<typeof RoomHello> | z.infer<typeof RoomPing> | z.infer<typeof RoomLeave>;

export type RoomErrorCode =
  | "full"
  | "started"
  | "not_found"
  | "bad_token"
  | "outdated"
  | "bad_message"
  | "not_host"
  | "not_ready";

/** The messages every room sends, whatever the game. `V` is the game's view of the room. */
export type CoreServerMessage<V> =
  | { type: "welcome"; you: string; room: V }
  | { type: "room"; room: V }
  | { type: "pong"; t: number; now: number }
  | { type: "error"; code: RoomErrorCode };

/** What the join screen can learn about a code before connecting. */
export interface RoomPeekOf<S extends string> {
  exists: boolean;
  players: number;
  status: S | null;
}
