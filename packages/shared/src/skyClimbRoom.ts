import { z } from "zod";
import { AvatarConfig } from "./avatar";
import { CLIMB_FLOORS, GHOST_POSES } from "./skyClimb";

// Sky Climb rooms: 1–3 friends race the same freshly seeded tower. A room lives in a
// Cloudflare Durable Object (apps/realtime); these are the messages both sides speak over
// its WebSocket. See Multiplayer.md.

export const ROOM_MAX_PLAYERS = 3;
/** The race ends this long after the start, whoever is still climbing. */
export const ROOM_RACE_SECONDS = 300;
/** Positions sent a second. */
export const ROOM_POS_HZ = 10;
/** From the host pressing Start to the race starting. */
export const ROOM_COUNTDOWN_MS = 3500;
/** A dropped player keeps their slot this long. */
export const ROOM_GRACE_MS = 15_000;
/** Bumped on any incompatible message change: older tabs are told to reload. */
export const ROOM_PROTOCOL_VERSION = 1;

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

/** Packed position: x, y, z in cm, facing in 1/256 turns, pose index (as live climbers send). */
const Cm = z.int().min(-1_000_000).max(1_000_000);
export const RoomPos = z.tuple([Cm, Cm, Cm, z.int().min(0).max(255), z.int().min(0).max(GHOST_POSES.length - 1)]);
export type RoomPos = z.infer<typeof RoomPos>;

export const RoomClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    v: z.int(),
    /** Supabase access token; absent for guests. Sent here rather than in the URL so it isn't logged. */
    token: z.string().max(4096).optional(),
    /** This browser's id: a guest gets their slot back with it after a dropped connection. */
    clientId: z.string().min(8).max(64),
    name: z.string().max(40),
    avatar: AvatarConfig.nullable(),
  }),
  z.object({ type: z.literal("ready"), on: z.boolean() }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("pos"), p: RoomPos }),
  z.object({ type: z.literal("progress"), floor: z.int().min(0).max(CLIMB_FLOORS) }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("rematch") }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("ping"), t: z.number() }),
]);
export type RoomClientMessage = z.infer<typeof RoomClientMessage>;

export type RoomStatus = "lobby" | "countdown" | "racing" | "results";

export interface RoomPlayerView {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  ready: boolean;
  /** False while a dropped player's slot is held for them. */
  connected: boolean;
  floor: number;
  /** Stopped climbing (summit, or gave up). */
  finished: boolean;
  /** Left during the race. */
  dnf: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: string | null;
  players: RoomPlayerView[];
  /** The tower being raced (set from the countdown on). */
  seed: string | null;
  /** Server time (ms) the race starts / ends. */
  startAt: number | null;
  endsAt: number | null;
  limitSec: number;
  /** Races played in this room. */
  round: number;
}

export interface RoomStanding {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  place: number;
  floor: number;
  /** Ms from the start to reaching `floor`. */
  ms: number | null;
  summit: boolean;
  dnf: boolean;
}

export type RoomErrorCode =
  | "full"
  | "started"
  | "not_found"
  | "bad_token"
  | "outdated"
  | "bad_message"
  | "not_host"
  | "not_ready";

export type RoomServerMessage =
  | { type: "welcome"; you: string; room: RoomView }
  | { type: "room"; room: RoomView }
  | { type: "pos"; id: string; p: RoomPos }
  | { type: "progress"; id: string; floor: number; at: number }
  | { type: "results"; standings: RoomStanding[] }
  | { type: "pong"; t: number; now: number }
  | { type: "error"; code: RoomErrorCode };

/** What the join screen can learn about a code before connecting. */
export interface RoomPeek {
  exists: boolean;
  players: number;
  status: RoomStatus | null;
}

/**
 * Places: the summit first (soonest wins), then the highest floor, reached soonest. Players
 * who left during the race come last.
 */
export function rankRoom(
  players: { id: string; name: string; avatar: AvatarConfig | null; floor: number; floorMs: number | null; dnf: boolean }[],
): RoomStanding[] {
  return players
    .slice()
    .sort((a, b) => Number(a.dnf) - Number(b.dnf) || b.floor - a.floor || (a.floorMs ?? Infinity) - (b.floorMs ?? Infinity))
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      place: i + 1,
      floor: p.floor,
      ms: p.floorMs,
      summit: p.floor >= CLIMB_FLOORS,
      dnf: p.dnf,
    }));
}
