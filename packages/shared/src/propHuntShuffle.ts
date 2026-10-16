// Prop Hunt: a fresh house every round. The walls and furniture stay put, but the things to hide
// as are shuffled from a seed: some go missing, some become something else of about their size,
// most are nudged and turned, and a few extra turn up on the floors. So a seeker can't learn
// "two mugs on this table" and spot the third. The room picks the seed; the server and every
// player build the same house from it.
import { kindBounds, partBox, type Box, type HouseMap, type MapProp, type PropKind } from "./propHunt";
import { BIG_HOUSE, areaAt } from "./propHuntHouse";

/** Chance a thing to hide as is left out this round. */
const DROP = 0.18;
/** Chance it becomes another thing of about its size. */
const SWAP = 0.55;
/** How far it may be nudged (world units): on a floor, and on a shelf or table top. */
const NUDGE_FLOOR = 0.9;
const NUDGE_RAISED = 0.3;
/** Tries at a changed placement before it keeps its own. */
const TRIES = 6;
/** Extra things on the floors, at most `EXTRA.min + EXTRA.spread`, near ones already there. */
const EXTRA = { min: 10, spread: 15, near: 1.5, far: 5, tries: 8 };
/** Nothing new goes within this of a spawn spot. */
const SPAWN_CLEAR = 1.8;
/** Two boxes only clash when they overlap by more than this (touching is fine). */
const GAP = 0.02;
/** A thing rests on a surface whose top is within this of its bottom. */
const REST = 0.03;
const CELL = 3;

/** The same small seeded random everywhere (server and browsers), so the house matches. */
export function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a round's house. */
export const newHouseSeed = () => 1 + Math.floor(Math.random() * 0xfffffffe);

interface Entry extends Box {
  /** The placed prop it belongs to (its index in the base map), or −1 for walls and furniture. */
  owner: number;
  /** A floor, stairs or other part of the house itself, rather than furniture. */
  floor: boolean;
}

/** Boxes by grid cell, so a clash check only looks at what's near. */
class Grid {
  private cells = new Map<number, Entry[]>();
  private key = (i: number, k: number) => (i + 4096) * 8192 + (k + 4096);
  add(e: Entry) {
    for (let i = Math.floor(e.x0 / CELL); i <= Math.floor(e.x1 / CELL); i++)
      for (let k = Math.floor(e.z0 / CELL); k <= Math.floor(e.z1 / CELL); k++) {
        const key = this.key(i, k);
        const list = this.cells.get(key);
        if (list) list.push(e);
        else this.cells.set(key, [e]);
      }
  }
  remove(owner: number) {
    for (const [key, list] of this.cells) {
      const kept = list.filter((e) => e.owner !== owner);
      if (kept.length !== list.length) this.cells.set(key, kept);
    }
  }
  near(b: Box): Entry[] {
    const out = new Set<Entry>();
    for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++)
      for (let k = Math.floor(b.z0 / CELL); k <= Math.floor(b.z1 / CELL); k++) for (const e of this.cells.get(this.key(i, k)) ?? []) out.add(e);
    return [...out];
  }
}

const clash = (a: Box, b: Box) => a.x0 < b.x1 - GAP && a.x1 > b.x0 + GAP && a.y0 < b.y1 - GAP && a.y1 > b.y0 + GAP && a.z0 < b.z1 - GAP && a.z1 > b.z0 + GAP;

/** Every box a placed thing to hide as fills (pass-through parts too: they'd still show through). */
const boxesOf = (kind: PropKind, p: { x: number; y: number; z: number; turn: number }) => kind.parts.map((part) => partBox(part, p));

/** The surface a point rests on: a box whose top is at `y` and that's under (x, z). */
function restingOn(grid: Grid, x: number, y: number, z: number): Entry | null {
  for (const e of grid.near({ x0: x, y0: y, z0: z, x1: x, y1: y, z1: z })) {
    if (Math.abs(e.y1 - y) < REST && x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1) return e;
  }
  return null;
}

/** The house for a round: `base` with its things to hide as shuffled by `seed`. */
export function shuffleHouse(base: HouseMap, seed: number): HouseMap {
  const rand = mulberry(seed);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const grid = new Grid();

  // The house and its furniture never move.
  for (const b of base.blocks) grid.add({ ...b, owner: -1, floor: true });
  const disguises: MapProp[] = [];
  for (const p of base.props) {
    const kind = base.kinds[p.kind];
    if (kind.disguise) disguises.push(p);
    else for (const part of kind.parts) if (!part.pass) grid.add({ ...partBox(part, p), owner: -1, floor: false });
  }
  // What rests on what, from the house as it was laid out (before anything moves).
  for (const p of disguises) for (const b of boxesOf(base.kinds[p.kind], p)) grid.add({ ...b, owner: p.id, floor: false });
  const support = new Map<number, Entry | null>();
  for (const p of disguises) {
    const centre = boxCentre(boxesOf(base.kinds[p.kind], p));
    support.set(p.id, restingOn(grid, centre[0], p.y, centre[1]));
  }
  // Spawn spots stay clear of anything that moves (nothing new may land on a player).
  const spawns: Box[] = [...base.hiderSpawns, base.seekerSpawn].map((s) => ({ x0: s.x - SPAWN_CLEAR, y0: s.y, z0: s.z - SPAWN_CLEAR, x1: s.x + SPAWN_CLEAR, y1: s.y + 3, z1: s.z + SPAWN_CLEAR }));

  const sizes = new Map<string, { foot: number; h: number }>();
  const pool = Object.values(base.kinds).filter((k) => k.disguise);
  for (const k of pool) {
    const b = kindBounds(k);
    sizes.set(k.id, { foot: Math.max(b.w, b.d), h: b.h });
  }
  /** Things to hide as about the size of `kind`, so a swap still fits where it was. */
  const alike = new Map<string, PropKind[]>();
  for (const k of pool) {
    const s = sizes.get(k.id)!;
    alike.set(
      k.id,
      pool.filter((o) => {
        const t = sizes.get(o.id)!;
        return t.foot <= s.foot * 1.3 + 0.2 && t.foot >= s.foot * 0.5 && t.h <= s.h * 1.5 + 0.3;
      }),
    );
  }

  /** Does this placement fit: clear of everything else, resting on `on`, away from spawns? */
  const fits = (kind: PropKind, p: { x: number; y: number; z: number; turn: number }, self: number, on: Entry | null, near: boolean) => {
    const boxes = boxesOf(kind, p);
    for (const b of boxes) {
      for (const e of grid.near(b)) if (e.owner !== self && clash(b, e)) return false;
      if (near && spawns.some((s) => clash(b, s))) return false;
    }
    if (!on) return true;
    const [cx, cz] = boxCentre(boxes);
    const under = restingOn(grid, cx, p.y, cz);
    return under !== null && (under === on || (under.owner === -1 && on.owner === -1 && under.floor === on.floor));
  };

  // Lowest first, so what rests on something is placed after it.
  const order = disguises.slice().sort((a, b) => a.y - b.y || a.id - b.id);
  const placed = new Map<number, MapProp>();
  for (const p of order) {
    const kind = base.kinds[p.kind];
    const on = support.get(p.id) ?? null;
    // Resting on another thing that's gone or moved: it goes too.
    if (on && on.owner >= 0 && placed.get(on.owner) !== base.props[on.owner]) {
      grid.remove(p.id);
      continue;
    }
    if (rand() < DROP) {
      grid.remove(p.id);
      continue;
    }
    let chosen: MapProp = p;
    // Nothing known underneath (an odd spot): it stays as it was.
    if (on) {
      const nudge = on.floor ? NUDGE_FLOOR : NUDGE_RAISED;
      for (let i = 0; i < TRIES; i++) {
        const k = rand() < SWAP ? pick(alike.get(kind.id)!) : kind;
        const next = { ...p, kind: k.id, x: p.x + (rand() * 2 - 1) * nudge, z: p.z + (rand() * 2 - 1) * nudge, turn: Math.floor(rand() * 4) };
        if (fits(k, next, p.id, on, true)) {
          chosen = next;
          break;
        }
      }
    }
    // Its own placement always fits: everything placed so far was checked against it.
    if (chosen !== p) {
      grid.remove(p.id);
      for (const b of boxesOf(base.kinds[chosen.kind], chosen)) grid.add({ ...b, owner: p.id, floor: false });
    }
    placed.set(p.id, chosen);
  }

  // A few extra on the floors, near things already there, so no room has a count to learn.
  const onFloor = [...placed.values()].filter((p) => support.get(p.id)?.floor);
  const extras: MapProp[] = [];
  const extraCount = EXTRA.min + Math.floor(rand() * (EXTRA.spread + 1));
  for (let n = 0; n < extraCount && onFloor.length; n++) {
    const anchor = pick(onFloor);
    const room = areaAt(base, anchor.x, anchor.y + 0.1, anchor.z);
    const on = support.get(anchor.id)!;
    for (let i = 0; i < EXTRA.tries; i++) {
      const k = pick(pool);
      const a = rand() * Math.PI * 2;
      const r = EXTRA.near + rand() * (EXTRA.far - EXTRA.near);
      const next = { id: -1, kind: k.id, x: anchor.x + Math.cos(a) * r, y: anchor.y, z: anchor.z + Math.sin(a) * r, turn: Math.floor(rand() * 4) };
      if (areaAt(base, next.x, next.y + 0.1, next.z) !== room || !fits(k, next, -2, on, true)) continue;
      const owner = base.props.length + extras.length;
      for (const b of boxesOf(k, next)) grid.add({ ...b, owner, floor: false });
      extras.push(next);
      break;
    }
  }

  // The base map's order (furniture and all), then the extras; ids are positions in the list.
  const props: MapProp[] = [];
  for (const p of base.props) {
    const out = base.kinds[p.kind].disguise ? placed.get(p.id) : p;
    if (out) props.push({ ...out, id: props.length });
  }
  for (const p of extras) props.push({ ...p, id: props.length });
  return { ...base, props };
}

function boxCentre(boxes: Box[]): [number, number] {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
  }
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

let last: { seed: number; map: HouseMap } | null = null;

/** The Big House for a round's seed (0: as it was laid out). The last one is kept, as both sides ask often. */
export function houseFor(seed: number): HouseMap {
  if (seed === 0) return BIG_HOUSE;
  if (last?.seed !== seed) last = { seed, map: shuffleHouse(BIG_HOUSE, seed) };
  return last.map;
}
