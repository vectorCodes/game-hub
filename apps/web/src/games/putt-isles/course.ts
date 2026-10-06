// Turns a hole template (an ASCII map) into kit tiles: which piece goes in each cell and
// how it's turned. Walls go wherever a cell has no neighbour, so any shape of fairway or
// green tiles itself. Pure data, no three.js: the server can rebuild a hole too.
import type { PuttCourseHole, PuttHoleTemplate, PuttIsland } from "@shadow/shared";
import { FLOOR_Y } from "./config";

export interface Tile {
  piece: string;
  x: number;
  z: number;
  /** Quarter turns about +y (three.js `rotation.y = rot * π/2`). */
  rot: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HoleLayout {
  id: string;
  name: string;
  par: number;
  island: PuttIsland | null;
  tiles: Tile[];
  /** Where the ball starts, on the green's surface. */
  tee: Vec3;
  cup: Vec3;
  /** Heading (yaw) out of the tee: the way the first shot naturally goes. */
  teeYaw: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** A side of a tile, as a unit step on the grid: [dx, dz]. */
type Side = readonly [number, number];
const PX: Side = [1, 0];
const NX: Side = [-1, 0];
const PZ: Side = [0, 1];
const NZ: Side = [0, -1];
const SIDES = [PX, NX, PZ, NZ] as const;

/** One quarter turn, as three.js turns an object by +π/2 about y. */
const turn = ([x, z]: readonly [number, number]): [number, number] => [z, -x];

function turned(v: readonly [number, number], k: number): [number, number] {
  let r: [number, number] = [v[0], v[1]];
  for (let i = 0; i < k; i++) r = turn(r);
  return r;
}

const key = ([x, z]: readonly [number, number]) => `${x},${z}`;

/** The quarter turns that put a piece's walls (as modelled) exactly on `want`, or -1. */
function fit(base: readonly Side[], want: Side[]): number {
  const target = new Set(want.map(key));
  for (let k = 0; k < 4; k++) {
    const got = base.map((s) => key(turned(s, k)));
    if (got.length === target.size && got.every((g) => target.has(g))) return k;
  }
  return -1;
}

/** Walled pieces by their walls, as the kit models them. */
const SHAPES: { piece: string; walls: Side[] }[] = [
  { piece: "open", walls: [] },
  { piece: "side", walls: [PX] },
  { piece: "straight", walls: [PX, NX] },
  { piece: "corner", walls: [PX, PZ] },
  { piece: "end", walls: [PX, NX, PZ] },
];

/** Cells that are an obstacle on a straight run (walls on both sides, open both ends). */
const STRAIGHT_SPECIALS: Record<string, string> = {
  H: "hill-round",
  S: "hill-square",
  B: "bump-walls",
  D: "bump-down-walls",
  X: "crest",
  O: "obstacle-block",
  N: "narrow-round",
  Q: "narrow-square",
  G: "gap",
  K: "castle",
  U: "tunnel-wide",
  R: "ramp-sharp",
};

/** Cells that sit in the open, with neighbours all round. */
const OPEN_SPECIALS: Record<string, string> = {
  o: "obstacle-diamond",
  b: "bump",
  d: "bump-down",
};

/** The inner-corner piece has its post at this corner. */
const INNER_POST: readonly [number, number] = [1, -1];

export function buildHole(t: PuttHoleTemplate | PuttCourseHole): HoleLayout {
  const rows = t.map;
  const at = (c: number, r: number) => (r >= 0 && r < rows.length ? (rows[r][c] ?? " ") : " ");
  const filled = (c: number, r: number) => at(c, r) !== " ";
  const tiles: Tile[] = [];
  let tee: Vec3 | null = null;
  let cup: Vec3 | null = null;
  let teeYaw = 0;
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === " ") return;
      const walls = SIDES.filter(([dx, dz]) => !filled(c + dx, r + dz));
      const where = `${t.id} (${c},${r}) '${ch}'`;
      const y = 0;
      const put = (piece: string, rot: number) => {
        if (rot < 0) throw new Error(`Hole ${where}: no ${piece} fits walls ${walls.map(key).join(" ")}`);
        tiles.push({ piece, x: c, z: r, rot, y });
      };
      bounds.minX = Math.min(bounds.minX, c - 0.5);
      bounds.maxX = Math.max(bounds.maxX, c + 0.5);
      bounds.minZ = Math.min(bounds.minZ, r - 0.5);
      bounds.maxZ = Math.max(bounds.maxZ, r + 0.5);

      if (ch in STRAIGHT_SPECIALS) return put(STRAIGHT_SPECIALS[ch], fit([PX, NX], walls) % 2);
      if (ch in OPEN_SPECIALS) return put(OPEN_SPECIALS[ch], walls.length ? -1 : 0);

      if (ch === "C") {
        cup = { x: c, y: y + FLOOR_Y, z: r };
        // A dead end gets the round-backed cup; out in the open, a cup with no walls.
        if (walls.length === 3) return put("hole-round", fit([PX, NX, PZ], walls));
        return put("hole-open", walls.length ? -1 : 0);
      }

      if (ch === "T") {
        tee = { x: c, y: y + FLOOR_Y, z: r };
        // Face out of the tee: towards the open side, or up the map from an open tee.
        const open = SIDES.filter((s) => !walls.includes(s));
        const [dx, dz] = open.length === 1 ? open[0] : NZ;
        teeYaw = Math.atan2(dx, dz);
      }

      // A plain cell: the walled piece that matches. An open cell with one missing diagonal
      // gets the inner-corner post there, to round the corner off.
      if (walls.length === 0) {
        const gaps = [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].filter(([dx, dz]) => !filled(c + dx, r + dz)) as [number, number][];
        if (gaps.length === 1) {
          for (let k = 0; k < 4; k++) {
            if (key(turned(INNER_POST, k)) === key(gaps[0])) return put("inner-corner", k);
          }
        }
        return put("open", 0);
      }
      for (const s of SHAPES) {
        if (s.walls.length !== walls.length) continue;
        const k = fit(s.walls, walls);
        if (k >= 0) return put(s.piece, k);
      }
      put("open", -1);
    });
  });

  if (!tee || !cup) throw new Error(`Hole ${t.id} needs a tee (T) and a cup (C)`);
  const island = "island" in t ? t.island : null;
  return { id: t.id, name: t.name, par: t.par, island, tiles, tee, cup, teeYaw, bounds };
}

/** Every distinct piece a set of holes uses, to preload. */
export function piecesOf(holes: HoleLayout[]): string[] {
  return [...new Set(holes.flatMap((h) => h.tiles.map((t) => t.piece)))];
}
