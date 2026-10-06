// Builds a tower from a seed. Same seed, same tower: everyone climbing today's daily gets
// exactly the same platforms, hazards and coins.
import { makeRng, towerVersion, type TwistId } from "@shadow/shared";
import {
  CANNON,
  CHECKPOINTS,
  FLOORS,
  PIECE_SIZE,
  POWERUP_MIN_FLOOR,
  POWERUP_SPACING,
  SET_PIECES,
  TOWER,
  UPDRAFT,
  ZONE_POWERUPS,
  isCheckpoint,
  knobs,
  setPieceAt,
  zoneOf,
  type CannonGrade,
  type PowerupKind,
  type SetPieceId,
  type Special,
  type ZoneId,
} from "./config";
import { SET_PIECE_STEPS, type Size } from "./setpieces";
import { rulesOf, towerTwist } from "./twists";

export { makeRng };

export type Kind = "static" | Special;

/** A decoration standing on a platform, in the platform's local frame. */
export interface Deco {
  piece: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

export interface Platform {
  id: number;
  floor: number;
  zone: ZoneId;
  piece: string;
  /** Pieces laid side by side along the platform's length (conveyors are two long). */
  tiles: number;
  /** Footprint along the path (w) and across it (d), and thickness (h). */
  w: number;
  d: number;
  h: number;
  /** Centre of the top surface, at rest. */
  x: number;
  top: number;
  z: number;
  /** Angle round the column (unwrapped: it keeps growing up the spiral). */
  theta: number;
  /** Turns the platform's length to follow the spiral. */
  yaw: number;
  kind: Kind;
  ice: boolean;
  /** Offset = axis × amp × sin(2π·t / period + phase). */
  motion?: { ax: number; ay: number; az: number; amp: number; period: number; phase: number };
  /** Solid for `on` seconds of every `period`. */
  vanish?: { period: number; on: number; phase: number };
  /** Conveyor speed along the platform's length (signed). */
  belt?: number;
  checkpoint: boolean;
  summit: boolean;
  deco: Deco[];
  /** Collapsing bridge plank: falls this many seconds after the bridge starts to go. */
  chain?: number;
  /** Lightning Sprint: vanishing with a thunderclap. */
  strike?: boolean;
  setPiece?: SetPieceId;
}

export interface Hazard {
  id: number;
  floor: number;
  platform: number;
  type: "saw" | "spikes";
  /** Saws sweep along the platform's length this far either side of its centre. */
  amp: number;
  period: number;
  phase: number;
}

export interface Coin {
  id: number;
  floor: number;
  x: number;
  y: number;
  z: number;
}

/** An orb floating over a platform: touch it for a power-up. */
export interface Powerup {
  id: number;
  floor: number;
  kind: PowerupKind;
  x: number;
  y: number;
  z: number;
}

/** A point on a cannon's flight, in the tower's own terms: round the column, out, up. */
export interface ArcEnd {
  theta: number;
  r: number;
  y: number;
}

/** A launch cannon standing in the middle of its platform. */
export interface Cannon {
  id: number;
  floor: number;
  /** Where the climber climbs in. */
  x: number;
  y: number;
  z: number;
  /** The barrel's heading (like the climber's facing) and its climb (radians up from level). */
  facing: number;
  pitch: number;
  /** The power meter's full sweep, in seconds. */
  period: number;
  from: ArcEnd;
  /** The floor each grade of shot lands on. */
  targets: Record<CannonGrade, number>;
}

/** Rising air between two platforms (the Updraft Canyon). */
export interface Updraft {
  id: number;
  floor: number;
  x: number;
  z: number;
  radius: number;
  bottom: number;
  top: number;
}

export interface Tower {
  seed: string;
  /** 1: the original towers. 2: twists, cannons and set-pieces. */
  version: 1 | 2;
  twist: TwistId | null;
  platforms: Platform[];
  hazards: Hazard[];
  coins: Coin[];
  powerups: Powerup[];
  cannons: Cannon[];
  updrafts: Updraft[];
  /** The set-pieces this tower has (version 2 only). */
  setPieces: typeof SET_PIECES;
  /** Top surface height of each floor's platform, at rest (index = floor). */
  floorTops: number[];
}

type Rng = ReturnType<typeof makeRng>;

const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
const pick = <T,>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)];

function weighted<K extends string>(rng: Rng, weights: Partial<Record<K, number>>): K | null {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((n, [, w]) => n + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export const CANNON_GRADES: CannonGrade[] = ["weak", "good", "perfect"];

/**
 * Where a cannon shot is, `u` (0…1) of the way through its flight: round the spiral, swung
 * out from the tower so it clears the platforms on the way, slowing at the top of the arc.
 */
export function cannonPoint(from: ArcEnd, to: ArcEnd, u: number, out: { x: number; y: number; z: number }) {
  const s = u + (CANNON.hang / (2 * Math.PI)) * Math.sin(2 * Math.PI * u);
  const theta = from.theta + (to.theta - from.theta) * s;
  const r = from.r + (to.r - from.r) * s + CANNON.swing * Math.sin(Math.PI * s);
  const lift = Math.max(3, (to.y - from.y) * 0.5 + 2);
  out.x = Math.cos(theta) * r;
  out.z = Math.sin(theta) * r;
  out.y = from.y + (to.y - from.y) * s + 4 * lift * s * (1 - s);
  return out;
}

export const arcEnd = (p: Platform): ArcEnd => ({ theta: p.theta, r: Math.hypot(p.x, p.z), y: p.top });

/** One cannon floor in each range, never on a checkpoint. Its own random stream. */
function pickCannonFloors(seed: string): number[] {
  const rng = makeRng(`${seed}:cannons`);
  return CANNON.ranges.map(([a, b]) => {
    const options: number[] = [];
    for (let f = a; f <= b; f++) if (!isCheckpoint(f)) options.push(f);
    return options[Math.floor(rng() * options.length)];
  });
}

export function generateTower(seed: string): Tower {
  const rng = makeRng(seed);
  const version = towerVersion(seed);
  const twist = towerTwist(seed);
  const rules = rulesOf(twist);
  const S = TOWER.pieceScale;
  const R = TOWER.pathRadius;
  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const coins: Coin[] = [];
  const updrafts: Updraft[] = [];
  const floorTops: number[] = [];
  const v2 = version === 2;
  // Cannon platforms and every floor a shot can land on are wide and plain.
  const cannonFloors = v2 ? pickCannonFloors(seed) : [];
  const cannonAt = new Set(cannonFloors);
  const landings = new Set(cannonFloors.flatMap((f) => CANNON_GRADES.map((g) => f + CANNON.lift[g])));
  const setPieces = v2 ? SET_PIECES : [];
  // The checkpoint after each set-piece pays a bonus row of coins.
  const bonusAt = new Set(setPieces.map((sp) => CHECKPOINTS.find((c) => c > sp.to)!).filter((c) => c < FLOORS));

  let theta = 0;
  // Always the same way round: turning back at a zone border would wind the new floors
  // right over the old ones, leaving no headroom to jump. (The mirror twist winds it the
  // other way all the way up.)
  const dir = rules.mirror ? -1 : 1;
  const coinOdds = rules.coins ?? { gap: 0.5, row: 0.35 };
  let prev: Platform | null = null;

  for (let floor = 0; floor <= FLOORS; floor++) {
    const zone = zoneOf(floor);
    const k = knobs(floor);
    const tempo = k.tempo * (rules.tempo ?? 1);
    const checkpoint = isCheckpoint(floor);
    const summit = floor === FLOORS;

    const sp = v2 ? setPieceAt(floor) : undefined;
    const step = sp ? SET_PIECE_STEPS[sp.id][floor - sp.from] : undefined;
    const forced = cannonAt.has(floor) || landings.has(floor);

    let size: Size = step ? step.size : checkpoint || forced ? "big" : (weighted(rng, k.sizes) ?? "normal");
    let kind: Kind = step ? step.kind : "static";
    const afterSpring = prev?.kind === "spring";
    if (!step && !forced && !checkpoint && !afterSpring && floor > 1 && rng() < k.special) kind = weighted(rng, zone.specials) ?? "static";
    // Land a spring's big bounce on something comfortable.
    if (!step && afterSpring && (size === "narrow" || size === "normal")) size = "long";

    let piece = step?.piece ?? zone.pieces[size];
    let tiles = 1;
    switch (kind) {
      case "moving":
      case "lift":
        piece = "block-moving";
        size = "normal";
        break;
      case "vanish":
        piece = "block-moving-blue";
        size = "normal";
        break;
      case "conveyor":
        piece = "conveyor-belt";
        tiles = 2;
        size = "long";
        break;
      case "spring":
        size = "normal";
        piece = zone.pieces.normal;
        break;
      case "crumble":
        if (size === "big") size = "long";
        piece = zone.pieces[size];
        break;
    }

    const [bw, bh, bd] = PIECE_SIZE[piece];
    const w = bw * S * tiles;
    const h = bh * S;
    const d = bd * S;

    let gap = k.gap * range(rng, 0.85, 1.15);
    let rise = k.rise * range(rng, 0.8, 1.1);
    if (afterSpring) {
      rise = range(rng, 2.6, 3.1);
      gap = range(rng, 0.4, 0.9);
    }
    if (step) {
      rise = step.rise;
      gap = step.gap;
    }
    const moveAmp = kind === "moving" ? range(rng, 0.7, 1.05) * S : kind === "lift" ? range(rng, 0.55, 0.85) : 0;
    // A shuttle's far swing must still leave the normal gap at its near end.
    if (kind === "moving") gap += moveAmp;

    let top = 0;
    if (prev) {
      theta += (dir * (prev.w / 2 + gap + w / 2)) / R;
      top = prev.top + rise;
    }
    const r = floor === 0 ? R : R + range(rng, -1, 1) * k.wander;
    const yaw = -theta - Math.PI / 2;
    // The platform's length (local x) in world space: along the spiral.
    const ax = Math.cos(yaw);
    const az = -Math.sin(yaw);

    const p: Platform = {
      id: floor,
      floor,
      zone: zone.id,
      piece,
      tiles,
      w,
      d,
      h,
      x: Math.cos(theta) * r,
      top,
      z: Math.sin(theta) * r,
      theta,
      yaw,
      kind,
      ice: (zone.ice || !!rules.ice) && !checkpoint && !step?.dry,
      checkpoint,
      summit,
      deco: [],
    };

    if (kind === "moving") {
      p.motion = { ax, ay: 0, az, amp: moveAmp, period: range(rng, 3.4, 4.4) / tempo, phase: rng() * Math.PI * 2 };
    } else if (kind === "lift") {
      p.motion = { ax: 0, ay: 1, az: 0, amp: moveAmp, period: range(rng, 3.2, 4.2) / tempo, phase: rng() * Math.PI * 2 };
    } else if (kind === "vanish") {
      const period = range(rng, 3.4, 4.2) / tempo;
      p.vanish = { period, on: period * 0.62, phase: rng() * period };
      if (step?.strike) {
        // Solid from `at` into each period: the platforms light up one after another.
        const { period: every, on, at } = step.strike;
        const pace = rules.tempo ?? 1;
        p.vanish = { period: every / pace, on: on / pace, phase: (every - (at % every)) / pace };
        p.strike = true;
      }
    } else if (kind === "conveyor") {
      // Pushes back against the way up.
      p.belt = -dir * range(rng, 1.5, 2.3) * tempo;
    }
    if (step?.collapseAfter !== undefined) p.chain = step.collapseAfter / tempo;
    if (sp) p.setPiece = sp.id;
    if (step?.updraft && prev) {
      // Halfway round the gap, at the platforms' mean distance from the column.
      const mid = (prev.theta + theta) / 2;
      const midR = (Math.hypot(prev.x, prev.z) + r) / 2;
      updrafts.push({
        id: updrafts.length,
        floor,
        x: Math.cos(mid) * midR,
        z: Math.sin(mid) * midR,
        radius: UPDRAFT.radius,
        bottom: prev.top - 4,
        top: top + 0.5,
      });
    }

    // Decorations: on the inner half (local +z faces the column), clear of the walking line.
    if (kind === "static" && !summit && !step && !cannonAt.has(floor) && (size === "big" || size === "long") && zone.deco.length) {
      const count = size === "big" ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const tall = pick(rng, zone.deco);
        const isTree = tall.startsWith("tree");
        if (isTree && size !== "big") continue;
        p.deco.push({
          piece: tall,
          x: range(rng, -w / 2 + 0.35, w / 2 - 0.35),
          z: isTree ? d / 2 - 0.45 : range(rng, d * 0.18, d / 2 - 0.2),
          yaw: rng() * Math.PI * 2,
          scale: S * (isTree ? range(rng, 0.7, 0.9) : range(rng, 0.85, 1.1)),
        });
      }
    }
    if (checkpoint && !summit && floor > 0) {
      p.deco.push({ piece: "flag", x: w / 2 - 0.4, z: d / 2 - 0.4, yaw: -Math.PI / 2, scale: S * 1.2 });
    }
    if (summit) {
      p.deco.push({ piece: "chest", x: 0, z: d / 2 - 0.55, yaw: Math.PI, scale: S * 1.6 });
      p.deco.push({ piece: "flag", x: -w / 2 + 0.4, z: d / 2 - 0.35, yaw: -Math.PI / 2, scale: S * 1.6 });
      p.deco.push({ piece: "flag", x: w / 2 - 0.4, z: d / 2 - 0.35, yaw: -Math.PI / 2, scale: S * 1.6 });
    }

    // Hazards ride on long and big plain platforms, never on checkpoints.
    if (step?.saw !== undefined) {
      const period = 2.4 / tempo;
      hazards.push({ id: hazards.length, floor, platform: p.id, type: "saw", amp: Math.max(0.2, w / 2 - 0.4), period, phase: step.saw * period });
    } else if (kind === "static" && !checkpoint && !forced && !step && floor > 2 && (size === "big" || size === "long") && rng() < k.hazard) {
      const type = weighted(rng, zone.hazards);
      if (type) {
        hazards.push({
          id: hazards.length,
          floor,
          platform: p.id,
          type,
          amp: Math.max(0.2, w / 2 - 0.4),
          period: (type === "saw" ? range(rng, 2.2, 2.8) : range(rng, 2.6, 3.2)) / tempo,
          phase: rng() * 10,
        });
      }
    }

    // Coins: over some gaps (a reward for jumping well), and a little row on some big platforms.
    if (prev && !afterSpring && rng() < coinOdds.gap) {
      coins.push({
        id: coins.length,
        floor,
        x: (prev.x + p.x) / 2,
        y: Math.max(prev.top, top) + 0.95,
        z: (prev.z + p.z) / 2,
      });
    }
    if (size === "big" && !checkpoint && !cannonAt.has(floor) && rng() < coinOdds.row) {
      for (const t of [-0.55, 0, 0.55]) {
        coins.push({ id: coins.length, floor, x: p.x + ax * t, y: top + 0.5, z: p.z + az * t });
      }
    }
    if (bonusAt.has(floor)) {
      for (const t of [-1, -0.5, 0, 0.5, 1]) {
        coins.push({ id: coins.length, floor, x: p.x + ax * t, y: top + 0.5, z: p.z + az * t });
      }
    }

    platforms.push(p);
    floorTops.push(top);
    prev = p;
  }

  const cannons = cannonFloors.map((f, id) => {
    const p = platforms[f];
    const from = arcEnd(p);
    const targets = Object.fromEntries(CANNON_GRADES.map((g) => [g, f + CANNON.lift[g]])) as Record<CannonGrade, number>;
    const to = arcEnd(platforms[targets.perfect]);
    // Coins strung along the perfect shot.
    for (let i = 1; i <= CANNON.coins; i++) {
      const u = i / (CANNON.coins + 1);
      const c = cannonPoint(from, to, u, { x: 0, y: 0, z: 0 });
      coins.push({ id: coins.length, floor: f + Math.round(u * CANNON.lift.perfect), x: c.x, y: c.y + 0.45, z: c.z });
    }
    // The barrel points along the start of the perfect shot.
    const a = cannonPoint(from, to, 0, { x: 0, y: 0, z: 0 });
    const b = cannonPoint(from, to, 0.03, { x: 0, y: 0, z: 0 });
    const cannon: Cannon = {
      id,
      floor: f,
      x: p.x,
      y: p.top,
      z: p.z,
      facing: Math.atan2(b.x - a.x, b.z - a.z),
      pitch: Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)),
      period: CANNON.period / (knobs(f).tempo * (rules.tempo ?? 1)),
      from,
      targets,
    };
    return cannon;
  });

  return {
    seed,
    version,
    twist,
    platforms,
    hazards,
    coins,
    powerups: placePowerups(seed, platforms, hazards),
    cannons,
    updrafts,
    setPieces,
    floorTops,
  };
}

/** Platforms that ask for something: a hazard, or a platform that moves, crumbles or vanishes. */
const RISKY: readonly Kind[] = ["moving", "lift", "vanish", "crumble", "conveyor"];

/**
 * Orbs go on a safe platform just before a risky one. They use their own random stream, so
 * adding or tuning them never changes the platforms, hazards or coins of any seed.
 */
function placePowerups(seed: string, platforms: Platform[], hazards: Hazard[]): Powerup[] {
  const rng = makeRng(`${seed}:powerups`);
  const hazardous = new Set(hazards.map((h) => h.platform));
  const out: Powerup[] = [];
  let last = -Infinity;
  for (const p of platforms) {
    // Every floor draws the same numbers whether or not it's used, so tuning one rule
    // doesn't reshuffle the rest of the tower.
    const roll = rng();
    const roll2 = rng();
    if (p.floor < POWERUP_MIN_FLOOR || p.summit || p.floor - last < POWERUP_SPACING) continue;
    if (!hazardous.has(p.id) && !RISKY.includes(p.kind)) continue;
    if (roll >= 0.7 + 0.2 * Math.min(1, p.floor / (FLOORS - 1))) continue;
    const kind = weighted(() => roll2, ZONE_POWERUPS[p.zone]);
    if (!kind) continue;
    // The nearest of the two platforms before it that is plain and hazard-free.
    const host = [platforms[p.floor - 1], platforms[p.floor - 2]].find(
      (h) => h && h.kind === "static" && !h.checkpoint && !hazardous.has(h.id) && h.floor > last,
    );
    if (!host) continue;
    const along = Math.min(0.95, host.w / 2 - 0.2);
    out.push({
      id: out.length,
      floor: host.floor,
      kind,
      x: host.x + Math.cos(host.yaw) * along,
      y: host.top + 0.55,
      z: host.z - Math.sin(host.yaw) * along,
    });
    last = p.floor;
  }
  return out;
}

/** The floor whose platform top is nearest below `y` (fractional between floors). */
export function floorAt(tower: Tower, y: number): number {
  const tops = tower.floorTops;
  if (y <= tops[0]) return 0;
  for (let i = 0; i < tops.length - 1; i++) {
    if (y < tops[i + 1]) return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
  }
  return tops.length - 1;
}
