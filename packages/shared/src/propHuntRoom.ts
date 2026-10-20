import { z } from "zod";
import type { AvatarConfig } from "./avatar";
import { HUNT_TAUNTS, type HuntXpGain } from "./propHuntLevels";
import { RoomHello, RoomLeave, RoomPing, type CoreServerMessage, type RoomPeekOf } from "./rooms";

// Prop Hunt rooms: 2–8 friends, hiders against seekers, a few rounds a match. A room lives in a
// Cloudflare Durable Object (apps/realtime, HuntRoom); these are the messages both sides speak
// over its WebSocket. See Prop-hunt-plan.md.

/** Bumped on any incompatible message change: older tabs are told to reload. */
export const HUNT_PROTOCOL_VERSION = 5;
/** Positions sent a second. */
export const HUNT_POS_HZ = 10;

/** The poses a player can be in, by index in a packed position. */
export const HUNT_POSES = ["idle", "walk", "sprint", "jump", "fall"] as const;
export type HuntPose = (typeof HUNT_POSES)[number];

/**
 * Packed position: x, y, z in cm, facing in 1/256 turns, pose index, and flags (bit 0: the
 * disguise's rotation is locked).
 */
const Cm = z.int().min(-1_000_000).max(1_000_000);
export const HuntPos = z.tuple([Cm, Cm, Cm, z.int().min(0).max(255), z.int().min(0).max(HUNT_POSES.length - 1), z.int().min(0).max(255)]);
export type HuntPos = z.infer<typeof HuntPos>;

/** A player id, or (to seekers) a hider's tag for this round. */
const Id = z.string().min(1).max(32);

export const HuntClientMessage = z.discriminatedUnion("type", [
  RoomHello,
  z.object({ type: z.literal("ready"), on: z.boolean() }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("pos"), p: HuntPos }),
  /** Become the placed prop `prop` (an index into the map's props), or yourself again. */
  z.object({ type: z.literal("disguise"), prop: z.int().min(0).max(10_000).nullable() }),
  /** A seeker's zap at `target` (as the seeker knows it), or at nothing; `at` is where the beam ends. */
  z.object({ type: z.literal("zap"), target: Id.nullable(), at: z.tuple([Cm, Cm, Cm]) }),
  /** `sound`: which of your taunts (one you've picked); the room picks one if it isn't. */
  z.object({ type: z.literal("taunt"), sound: z.string().max(32).optional() }),
  /** Your picked taunts (one plays every time, several shuffle) and your level, to show the others. */
  z.object({ type: z.literal("loadout"), taunts: z.array(z.string().max(32)).min(1).max(HUNT_TAUNTS.length), level: z.int().min(1).max(999).nullable() }),
  /** Leave a decoy of the prop you've become, here (`p`'s position and facing). */
  z.object({ type: z.literal("decoy"), p: HuntPos }),
  z.object({ type: z.literal("sonar") }),
  z.object({ type: z.literal("rematch") }),
  RoomLeave,
  RoomPing,
]);
export type HuntClientMessage = z.infer<typeof HuntClientMessage>;

/**
 * lobby → countdown → hide → seek → round (that round's results) → hide … → results (the
 * podium) → lobby again on a rematch.
 */
export type HuntStatus = "lobby" | "countdown" | "hide" | "seek" | "round" | "results";
export type HuntRole = "hider" | "seeker";
/** Who won a round. */
export type HuntSide = "hiders" | "seekers";

export interface HuntPlayerView {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  ready: boolean;
  /** False while a dropped player's slot is held for them. */
  connected: boolean;
  /** Left during the match. */
  dnf: boolean;
  /** This round's role (null in the lobby). A found hider stays a hider, out (and watching) until the next round. */
  role: HuntRole | null;
  /** Was a hider this round and got found. */
  found: boolean;
  /** Seekers' health: misses cost some, finds give some back. */
  hp: number;
  /** Server time a dizzy seeker can zap again (null when not dizzy). */
  dizzyUntil: number | null;
  /** Match total. */
  score: number;
  /** Which of the map's hider spawns this player starts at this round. */
  spawn: number;
  /** Decoys left this round. */
  decoys: number;
  /** Prop Hunt level, for signed-in players. */
  level: number | null;
}

export interface HuntLastRound {
  round: number;
  winners: HuntSide;
  /** Points each player made in that round. */
  points: Record<string, number>;
}

export interface HuntView {
  code: string;
  status: HuntStatus;
  hostId: string | null;
  players: HuntPlayerView[];
  /** 1-based; 0 before the first. */
  round: number;
  /** Rounds in this match. */
  rounds: number;
  /** Server time (ms) the current phase ends: the countdown, hiding, seeking, a round's results. */
  phaseEndsAt: number | null;
  /** When seeking started this round (for quick finds and the sonar). */
  seekStartedAt: number | null;
  lastRound: HuntLastRound | null;
  /** Seeds this round's house (`houseFor`): the things to hide as are shuffled every round. */
  mapSeed: number;
}

export interface HuntStanding {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  place: number;
  score: number;
  dnf: boolean;
}

export type HuntServerMessage =
  | CoreServerMessage<HuntView>
  /** A position, relayed. `id` is a hider's tag when sent to seekers. */
  | { type: "pos"; id: string; p: HuntPos }
  /** Someone became a prop (`kind`), or themselves again (null). */
  | { type: "disguised"; id: string; kind: string | null }
  | { type: "zapped"; by: string; target: string | null; hit: boolean; at: [number, number, number] }
  /** A hider was found: they're out until the next round (and known by their id to everyone). `by` is empty when a hider took over from seekers who all left. */
  | { type: "found"; id: string; tag: string; by: string }
  | { type: "taunt"; id: string; sound: string; forced: boolean }
  /** A decoy prop, standing still at `p`. Its id looks like a hider's tag; `mine` only to the hider who left it. */
  | { type: "decoy"; id: string; kind: string; p: HuntPos; mine: boolean }
  /** A seeker (`by`) zapped a decoy: it's gone, and that counted as a miss. */
  | { type: "decoyPopped"; id: string; by: string; mine: boolean }
  /** Hiders who weren't disguised when seeking began: shown to everyone for a moment. */
  | { type: "exposed"; ids: string[] }
  /** Only to the seeker who used it: which way the nearest hider is (a unit vector on the ground). */
  | { type: "sonar"; dir: [number, number] }
  | { type: "results"; standings: HuntStanding[] }
  /** Only to a signed-in player, once the API has saved the match: their XP (null if it couldn't be saved). */
  | { type: "xp"; gain: HuntXpGain | null };

export type HuntPeek = RoomPeekOf<HuntStatus>;

/** Final places: the highest score first; players who left come last. */
export function rankHunt(players: { id: string; name: string; avatar: AvatarConfig | null; score: number; dnf: boolean }[]): HuntStanding[] {
  return players
    .slice()
    .sort((a, b) => Number(a.dnf) - Number(b.dnf) || b.score - a.score)
    .map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, place: i + 1, score: p.score, dnf: p.dnf }));
}

