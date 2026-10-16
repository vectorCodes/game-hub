// Prop Hunt: the rules both the room server and the web app play by, and the shapes the map is
// made of. See Prop-hunt-plan.md. Units: the avatar is 0.9 tall and stands for about 20 cm, so
// 1 unit ≈ 22 cm and an ordinary house becomes a huge world.

export const HUNT_MAX_PLAYERS = 8;
export const HUNT_MIN_PLAYERS = 2;
/** A match is one round per player (everyone seeks once), up to this many. */
export const HUNT_MAX_ROUNDS = 6;
/** From the host pressing Start to the first hide. */
export const HUNT_COUNTDOWN_MS = 3500;
export const HUNT_HIDE_SECONDS = 40;
export const HUNT_SEEK_SECONDS = 240;
export const HUNT_ROUND_RESULTS_MS = 8000;
export const HUNT_ZAP_RANGE = 6;
export const HUNT_ZAP_COOLDOWN_MS = 500;
export const HUNT_MISS_DAMAGE = 10;
export const HUNT_HIT_HEAL = 25;
export const HUNT_DIZZY_MS = 5000;
export const HUNT_TAUNT_COOLDOWN_MS = 10_000;
export const HUNT_FORCED_TAUNT = { fromSecondsLeft: 60, everyMs: 20_000 } as const;
/** Sonar unlocks with this much seeking left (earlier in small rooms, where the house feels empty). */
export const HUNT_SONAR_FROM_SECONDS_LEFT = 60;
export const HUNT_SONAR_SMALL_ROOM = { players: 3, fromSecondsLeft: 120 } as const;
/** HP a seeker starts each round with, and comes back with after being dizzy. */
export const HUNT_HP = 100;
export const HUNT_HP_AFTER_DIZZY = 50;
/** Zaps reach this much further on the server than on screen, for latency. */
export const HUNT_ZAP_SLACK = 1.5;

export const HUNT_POINTS = {
  find: 100,
  /** Extra for a find in the first `quickSeconds` of seeking. */
  quickFind: 50,
  quickSeconds: 30,
  /** A hider still hidden, every `surviveEverySeconds` of seeking. */
  survive: 20,
  surviveEverySeconds: 30,
  /** A hider still hidden when the time runs out. */
  surviveRound: 150,
  taunt: 5,
  /** The last hider found in a round. */
  lastStanding: 50,
} as const;
/** A disguise is at most this wide (it must fit through a doorway). */
export const HUNT_MAX_DISGUISE = 2.5;

export const seekersFor = (players: number) => (players <= 4 ? 1 : 2);

/** An axis-aligned box: what every collider is. */
export interface Box {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export type PartShape = "box" | "cyl" | "ball" | "cone";

/** One primitive of a greybox prop. `at` is its bottom centre, relative to the prop's origin. */
export interface PropPart {
  shape: PartShape;
  /** Width (x), height (y), depth (z). A cylinder, ball or cone fills this box. */
  size: [number, number, number];
  at?: [number, number, number];
  color: string;
  /** Drawn but never collides: a tree's canopy, the clothes in a wardrobe. */
  pass?: boolean;
  /** What it's made of, for the art ("oak", "ceramic"…); `color` is the greybox look (and tints plain materials). */
  surface?: string;
}

export interface PropKind {
  id: string;
  name: string;
  parts: PropPart[];
  /** Hiders can become it. Everything else is furniture. Either way, it's solid. */
  disguise: boolean;
}

/** A placed prop. `turn` is in quarter turns; turn 0 faces +z, turn 1 faces +x. */
export interface MapProp {
  id: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  turn: number;
}

/** Walls, floors, steps: plain boxes. `color: null` is an invisible boundary. */
export interface Block extends Box {
  color: string | null;
  /** Floor slabs don't cast shadows, so the sun still lights the rooms below. */
  shadow: boolean;
  /** What it's made of, for the art ("plaster", "kitchen"…); `color` is the greybox look. */
  surface?: string;
}

export interface Area extends Box {
  name: string;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
}

export interface HouseMap {
  id: string;
  kinds: Record<string, PropKind>;
  blocks: Block[];
  props: MapProp[];
  /** Long grass: drawn, never collides. */
  grass: { x0: number; z0: number; x1: number; z1: number }[];
  areas: Area[];
  /** Each flight of stairs, and which way it climbs (on the ground, +z or −z), for the minimap. */
  stairs: (Box & { up: "+z" | "-z" })[];
  hiderSpawns: Spot[];
  seekerSpawn: Spot;
}

/** (x, z) turned by quarter turns, the way three.js turns an object about y. */
export function turnXZ(x: number, z: number, turn: number): [number, number] {
  switch (((turn % 4) + 4) % 4) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

/** The box a part fills once its prop is placed. */
export function partBox(part: PropPart, p: { x: number; y: number; z: number; turn: number }): Box {
  const [ox, oy, oz] = part.at ?? [0, 0, 0];
  const [cx, cz] = turnXZ(ox, oz, p.turn);
  const odd = p.turn % 2 !== 0;
  const hw = (odd ? part.size[2] : part.size[0]) / 2;
  const hd = (odd ? part.size[0] : part.size[2]) / 2;
  const x = p.x + cx;
  const z = p.z + cz;
  const y = p.y + oy;
  return { x0: x - hw, y0: y, z0: z - hd, x1: x + hw, y1: y + part.size[1], z1: z + hd };
}

/** A prop's footprint and height, unturned: what a disguise's collider is made from. */
export function kindBounds(kind: PropKind): { w: number; h: number; d: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, h = 0;
  for (const part of kind.parts) {
    const b = partBox(part, { x: 0, y: 0, z: 0, turn: 0 });
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
    h = Math.max(h, b.y1);
  }
  return { w: x1 - x0, h, d: z1 - z0 };
}

export interface Collider extends Box {
  /** The house itself (floors, stairs): walked up without a jump. Props always need one. */
  step: boolean;
}

/** Every collider of a map: its blocks, then every part of every prop (a mug is solid too). */
export function mapColliders(map: HouseMap): Collider[] {
  const out: Collider[] = map.blocks.map(({ x0, y0, z0, x1, y1, z1 }) => ({ x0, y0, z0, x1, y1, z1, step: true }));
  for (const p of map.props) {
    const kind = map.kinds[p.kind];
    if (kind) for (const part of kind.parts) if (!part.pass) out.push({ ...partBox(part, p), step: false });
  }
  return out;
}

/** Can a hider become this placed prop? (The room server checks every disguise with this.) */
export function canDisguiseAs(map: HouseMap, propId: number): boolean {
  const prop = map.props[propId];
  return prop !== undefined && map.kinds[prop.kind]?.disguise === true;
}
