import { z } from "zod";
import type { AvatarConfig } from "./avatar";
import { BUMPER_MAPS, HEX } from "./bumper";
import type { BumperEvent, BumperSim, HexTile, Ring } from "./bumperSim";
import { RoomHello, RoomLeave, RoomPing, type CoreServerMessage, type RoomPeekOf } from "./rooms";

// Bumper Arena party rooms: 2–4 friends, every ring for itself, a match of rounds. A room lives
// in a Cloudflare Durable Object (apps/realtime, BumperRoom) that runs the physics and is the
// only judge; clients send their stick and buttons, and draw the snapshots it sends back
// (predicting their own ring in between). See Bumper-arena-plan.md.

/** Bumped on any incompatible message change: older tabs are told to reload. */
export const BUMPER_PROTOCOL_VERSION = 2;
export const BUMPER_MIN_PLAYERS = 2;
export const BUMPER_MAX_PLAYERS = 4;

/** The room's sim step (s): the same step the solo game uses, so prediction replays it exactly. */
export const BUMPER_STEP = 1 / 60;
/** A snapshot every this many steps (15 a second). */
export const BUMPER_SNAP_EVERY = 4;
/** Inputs sent a second, at most (and only when they change)… */
export const BUMPER_INPUT_HZ = 15;
/** …plus the same one again this often, so the room's count of steps doesn't drift from ours. */
export const BUMPER_INPUT_KEEPALIVE_MS = 500;

export const BUMPER_ROUND_CHOICES = [3, 5, 7] as const;
export const BUMPER_DEFAULT_ROUNDS = 5;
/** A round's results stay up this long before the next round. */
export const BUMPER_ROUND_RESULTS_MS = 6000;
/** A round still going after this long ends: whoever is still on shares it. */
export const BUMPER_ROUND_MAX_SECONDS = 150;
/** Points for 1st, 2nd and 3rd in a round (last place gets none), and for a knockout. */
export const BUMPER_PLACE_POINTS = [5, 3, 2];
export const BUMPER_KO_POINTS = 2;

/** A different arena each round, or the same one every round. */
export const BUMPER_ROTATION = "rotation";
const MapChoice = z.string().refine((m) => m === BUMPER_ROTATION || m in BUMPER_MAPS);

export const BumperSettings = z.object({
  map: MapChoice,
  rounds: z.literal(BUMPER_ROUND_CHOICES),
});
export type BumperSettings = z.infer<typeof BumperSettings>;

const Stick = z.int().min(-100).max(100);

export const BumperClientMessage = z.discriminatedUnion("type", [
  RoomHello,
  z.object({ type: z.literal("ready"), on: z.boolean() }),
  z.object({ type: z.literal("start") }),
  /** The host's lobby settings. */
  z.object({ type: z.literal("settings"), settings: BumperSettings }),
  /**
   * The stick (x, z: -100–100), brace held, and a dash count (a new number: a dash). `s` is our
   * own step count when this input took effect, echoed back in snapshots for prediction.
   */
  z.object({ type: z.literal("input"), s: z.int().min(0), x: Stick, z: Stick, b: z.boolean(), d: z.int().min(0).max(255) }),
  z.object({ type: z.literal("rematch") }),
  RoomLeave,
  RoomPing,
]);
export type BumperClientMessage = z.infer<typeof BumperClientMessage>;

/** lobby → round (its countdown included) → roundOver (its results) → round … → results (the podium) → lobby on a rematch. */
export type BumperStatus = "lobby" | "round" | "roundOver" | "results";

export interface BumperPlayerView {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  ready: boolean;
  /** False while a dropped player's slot is held for them. */
  connected: boolean;
  /** Left during the match. */
  dnf: boolean;
  /** Ring colour, 0–3: kept for the whole time in the room. */
  color: number;
  /** Match totals. */
  score: number;
  roundWins: number;
  kos: number;
}

export interface BumperRoundResult {
  round: number;
  map: string;
  /** Places this round (1 = won; rings that went together share one). */
  places: Record<string, number>;
  points: Record<string, number>;
  kos: Record<string, number>;
}

export interface BumperView {
  code: string;
  status: BumperStatus;
  hostId: string | null;
  players: BumperPlayerView[];
  settings: BumperSettings;
  /** 1-based; 0 before the first. */
  round: number;
  rounds: number;
  /** This round's arena. */
  map: string | null;
  /** This round's rings, in spawn order (snapshots list them in this order too). */
  entrants: string[];
  /** Server time (ms) a round's results end. */
  phaseEndsAt: number | null;
  lastRound: BumperRoundResult | null;
}

export interface BumperStanding {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  color: number;
  place: number;
  score: number;
  roundWins: number;
  kos: number;
  dnf: boolean;
}

/**
 * One ring in a snapshot: x, z, y, vx, vz (cm, cm/s), facing (1/256 turns), wobble (%), flags
 * (bit 0 braced, bits 1–2 the state), dash left, dash cooldown, brace cooldown, brace held
 * (all 1/100 s), and the player's input echo: the step count of the last input applied, and
 * how many steps the room has run it since.
 */
export type BumperSnapRing = [number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export interface BumperSnap {
  type: "snap";
  /** The room's step count this round. */
  n: number;
  /** Round time (ms; negative in the countdown). */
  t: number;
  phase: BumperSim["phase"];
  winner: string | null;
  /** Spinner: the bar's heading (1/1000 rad). */
  spin?: number;
  /** Hex Hive: one character a tile (packTiles). */
  tiles?: string;
  rings: BumperSnapRing[];
  /** What happened since the last snapshot. */
  events: BumperEvent[];
}

export type BumperServerMessage = CoreServerMessage<BumperView> | BumperSnap | { type: "results"; standings: BumperStanding[] };

export type BumperPeek = RoomPeekOf<BumperStatus>;

// ---------- Packing ----------

const STATES = ["in", "falling", "out"] as const;
const cm = (m: number) => Math.round(m * 100);
const cs = (s: number) => Math.round(s * 100);

export function packRing(r: Ring, ack: number, since: number): BumperSnapRing {
  const turn = Math.round(((((r.facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 256) % 256;
  const flags = (r.bracing ? 1 : 0) | (STATES.indexOf(r.state) << 1);
  return [cm(r.x), cm(r.z), cm(Math.max(-100, r.y)), cm(r.vx), cm(r.vz), turn, Math.round(r.wobble), flags, cs(r.dashLeft), cs(r.dashCooldown), cs(r.braceCooldown), cs(r.braceHeld), ack, since];
}

/** Puts a snapshot's ring into `r` (positions and timers; the input echo is the caller's). */
export function unpackRing(s: BumperSnapRing, r: Ring) {
  r.x = s[0] / 100;
  r.z = s[1] / 100;
  r.y = s[2] / 100;
  r.vx = s[3] / 100;
  r.vz = s[4] / 100;
  r.facing = (s[5] / 256) * Math.PI * 2;
  r.wobble = s[6];
  r.bracing = (s[7] & 1) === 1;
  r.state = STATES[(s[7] >> 1) & 3] ?? "in";
  r.dashLeft = s[8] / 100;
  r.dashCooldown = s[9] / 100;
  r.braceCooldown = s[10] / 100;
  r.braceHeld = s[11] / 100;
}

/** A tile a character: its wear in tenths ("0"–"9") while up, "c" cracking, "d" dropped. */
export function packTiles(tiles: HexTile[]): string {
  return tiles.map((t) => (t.state === "up" ? String(Math.min(9, Math.floor((t.wear / HEX.wearSeconds) * 10))) : t.state === "cracking" ? "c" : "d")).join("");
}

/** Brings `tiles` up to a snapshot's; a tile that changed starts its crack (or drop) at round time `t`. */
export function unpackTiles(text: string, tiles: HexTile[], t: number) {
  tiles.forEach((tile, i) => {
    const c = text[i];
    if (c === undefined) return;
    if (c === "c" || c === "d") {
      const state = c === "c" ? "cracking" : "down";
      if (tile.state !== state) tile.at = state === "down" && tile.state === "up" ? t - HEX.crackSeconds : tile.state === "up" ? t : tile.at;
      tile.state = state;
    } else {
      tile.state = "up";
      tile.wear = (Number(c) / 10) * HEX.wearSeconds;
    }
  });
}

// ---------- Scoring ----------

/** Places at the end of a round: rings still on share first, the rest by how late they went over (together: the same place). */
export function roundPlaces(rings: Ring[]): Record<string, number> {
  const key = (r: Ring) => (r.state === "in" ? Infinity : (r.fellAt ?? -Infinity));
  const sorted = rings.slice().sort((a, b) => key(b) - key(a));
  const places: Record<string, number> = {};
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    places[r.id] = prev && key(prev) === key(r) ? places[prev.id] : i + 1;
  });
  return places;
}

/** A round's points for a place: 5, 3, 2, and none for the last ring (unless everyone shared first). */
export function placePoints(place: number, places: Record<string, number>): number {
  const worst = Math.max(...Object.values(places));
  if (place === worst && worst > 1) return 0;
  return BUMPER_PLACE_POINTS[place - 1] ?? 0;
}

/** Final places: the most points; then more rounds won, then more knockouts. Players who left come last. */
export function rankBumper(players: Omit<BumperStanding, "place">[]): BumperStanding[] {
  const cmp = (a: Omit<BumperStanding, "place">, b: Omit<BumperStanding, "place">) =>
    Number(a.dnf) - Number(b.dnf) || b.score - a.score || b.roundWins - a.roundWins || b.kos - a.kos;
  const sorted = players.slice().sort(cmp);
  const out: BumperStanding[] = [];
  sorted.forEach((p, i) => {
    const prev = out[i - 1];
    out.push({ ...p, place: prev && cmp(sorted[i - 1], p) === 0 ? prev.place : i + 1 });
  });
  return out;
}
