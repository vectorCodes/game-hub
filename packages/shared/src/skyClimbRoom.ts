import { z } from "zod";
import type { AvatarConfig } from "./avatar";
import { RoomHello, RoomLeave, RoomPing, type CoreServerMessage, type RoomPeekOf } from "./rooms";
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
/** Bumped on any incompatible message change: older tabs are told to reload. */
export const ROOM_PROTOCOL_VERSION = 1;

/** Packed position: x, y, z in cm, facing in 1/256 turns, pose index (as live climbers send). */
const Cm = z.int().min(-1_000_000).max(1_000_000);
export const RoomPos = z.tuple([Cm, Cm, Cm, z.int().min(0).max(255), z.int().min(0).max(GHOST_POSES.length - 1)]);
export type RoomPos = z.infer<typeof RoomPos>;

export const RoomClientMessage = z.discriminatedUnion("type", [
  RoomHello,
  z.object({ type: z.literal("ready"), on: z.boolean() }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("pos"), p: RoomPos }),
  z.object({ type: z.literal("progress"), floor: z.int().min(0).max(CLIMB_FLOORS) }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("rematch") }),
  RoomLeave,
  RoomPing,
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

export type RoomServerMessage =
  | CoreServerMessage<RoomView>
  | { type: "pos"; id: string; p: RoomPos }
  | { type: "progress"; id: string; floor: number; at: number }
  | { type: "results"; standings: RoomStanding[] };

/** What the join screen can learn about a code before connecting. */
export type RoomPeek = RoomPeekOf<RoomStatus>;

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
