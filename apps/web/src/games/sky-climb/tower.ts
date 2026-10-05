// Builds a tower from a seed. Same seed, same tower: everyone climbing today's daily gets
// exactly the same platforms, hazards and coins.
import {
  FLOORS,
  PIECE_SIZE,
  TOWER,
  isCheckpoint,
  knobs,
  zoneOf,
  type Special,
  type ZoneId,
} from "./config";

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

export interface Tower {
  seed: string;
  platforms: Platform[];
  hazards: Hazard[];
  coins: Coin[];
  /** Top surface height of each floor's platform, at rest (index = floor). */
  floorTops: number[];
}

/** Seeded random numbers in [0, 1): xmur3 hash into mulberry32. */
export function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

type Size = "big" | "long" | "normal" | "narrow";

export function generateTower(seed: string): Tower {
  const rng = makeRng(seed);
  const S = TOWER.pieceScale;
  const R = TOWER.pathRadius;
  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const coins: Coin[] = [];
  const floorTops: number[] = [];

  let theta = 0;
  let dir = 1;
  let prev: Platform | null = null;

  for (let floor = 0; floor <= FLOORS; floor++) {
    const zone = zoneOf(floor);
    const k = knobs(floor);
    const checkpoint = isCheckpoint(floor);
    const summit = floor === FLOORS;
    // Each new zone turns the spiral the other way round.
    if (floor > 0 && zone.from === floor) dir = -dir;

    let size: Size = checkpoint ? "big" : (weighted(rng, k.sizes) ?? "normal");
    let kind: Kind = "static";
    const afterSpring = prev?.kind === "spring";
    if (!checkpoint && !afterSpring && floor > 1 && rng() < k.special) kind = weighted(rng, zone.specials) ?? "static";
    // Land a spring's big bounce on something comfortable.
    if (afterSpring && (size === "narrow" || size === "normal")) size = "long";

    let piece = zone.pieces[size];
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
      yaw,
      kind,
      ice: zone.ice && !checkpoint,
      checkpoint,
      summit,
      deco: [],
    };

    if (kind === "moving") {
      p.motion = { ax, ay: 0, az, amp: moveAmp, period: range(rng, 3.4, 4.4) / k.tempo, phase: rng() * Math.PI * 2 };
    } else if (kind === "lift") {
      p.motion = { ax: 0, ay: 1, az: 0, amp: moveAmp, period: range(rng, 3.2, 4.2) / k.tempo, phase: rng() * Math.PI * 2 };
    } else if (kind === "vanish") {
      const period = range(rng, 3.4, 4.2) / k.tempo;
      p.vanish = { period, on: period * 0.62, phase: rng() * period };
    } else if (kind === "conveyor") {
      // Pushes back against the way up.
      p.belt = -dir * range(rng, 1.5, 2.3) * k.tempo;
    }

    // Decorations: on the inner half (local +z faces the column), clear of the walking line.
    if (kind === "static" && !summit && (size === "big" || size === "long") && zone.deco.length) {
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
    if (kind === "static" && !checkpoint && floor > 2 && (size === "big" || size === "long") && rng() < k.hazard) {
      const type = weighted(rng, zone.hazards);
      if (type) {
        hazards.push({
          id: hazards.length,
          floor,
          platform: p.id,
          type,
          amp: Math.max(0.2, w / 2 - 0.4),
          period: (type === "saw" ? range(rng, 2.2, 2.8) : range(rng, 2.6, 3.2)) / k.tempo,
          phase: rng() * 10,
        });
      }
    }

    // Coins: over some gaps (a reward for jumping well), and a little row on some big platforms.
    if (prev && !afterSpring && rng() < 0.5) {
      coins.push({
        id: coins.length,
        floor,
        x: (prev.x + p.x) / 2,
        y: Math.max(prev.top, top) + 0.95,
        z: (prev.z + p.z) / 2,
      });
    }
    if (size === "big" && !checkpoint && rng() < 0.35) {
      for (const t of [-0.55, 0, 0.55]) {
        coins.push({ id: coins.length, floor, x: p.x + ax * t, y: top + 0.5, z: p.z + az * t });
      }
    }

    platforms.push(p);
    floorTops.push(top);
    prev = p;
  }

  return { seed, platforms, hazards, coins, floorTops };
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
