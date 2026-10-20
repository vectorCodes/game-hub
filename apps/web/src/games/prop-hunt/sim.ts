// The player's movement through the house, without any rendering: run, sprint, jump, walk up
// steps, and bump into walls and furniture. Every collider is an axis-aligned box, so there's
// no physics engine: move along x, push out of anything solid, then z, then fall and land.
import { HUNT_TAUNT_COOLDOWN_MS, HUNT_TAUNT_SOUNDS, kindBounds, mapColliders, type Box, type Collider, type HouseMap, type PropKind, type Spot } from "@shadow/shared";
import { FALL_LIMIT, PHYS } from "./config";

export interface Input {
  /** Keys or stick: x right, y forward (away from the camera), each −1…1. */
  x: number;
  y: number;
  jumpHeld: boolean;
  /** Set when jump goes down; the sim clears it once read. */
  jumpPressed: boolean;
  sprint: boolean;
}

export type SimEvent =
  | { type: "jump" }
  | { type: "land"; speed: number }
  | { type: "respawn" }
  | { type: "become"; kind: PropKind | null }
  | { type: "taunt"; sound: number }
  | { type: "decoy" };

const TAUNT_COOLDOWN = HUNT_TAUNT_COOLDOWN_MS / 1000;

const EPS = 1e-4;
/** Grid cell size for finding nearby colliders (world units). */
const CELL = 6;
const cellKey = (i: number, k: number) => (i + 4096) * 8192 + (k + 4096);
/** How far beyond the player's square to look for colliders: more than a step can move. */
const PAD = 1;
/** Props are only walked onto if they're about this flat (a rug); anything taller needs a jump. */
const LIP = 0.12;
/** The head checks ceilings with a narrower square, so you can stand at a shelf's edge and jump. */
const HEAD = 0.55;

export class HuntSim {
  /** The house's colliders (walls, floors, furniture, props). */
  colliders: Collider[] = [];
  /** Anything that moves (other players disguised as props), replaced every frame. */
  private moving: Collider[] = [];
  /** The colliders by grid cell, so a step only looks at what's near. */
  private grid = new Map<number, Collider[]>();
  private nearby: Collider[] = [];
  private seen = new Set<Collider>();
  events: SimEvent[] = [];

  player = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    coyote: 0,
    buffer: 0,
    canCut: false,
    facing: 0,
    /** 0…1 of the sprint bar left. */
    stamina: 1,
    sprinting: false,
  };

  /** Seconds of play so far. */
  t = 0;
  /** When the next taunt is allowed (sim time). */
  tauntReady = 0;
  /** The prop you've become, or null as yourself. */
  disguise: PropKind | null = null;
  /** Rotation lock: the disguise keeps its facing while you move and look around. */
  locked = false;
  private size: { half: number; height: number } = { half: PHYS.half, height: PHYS.height };

  /** `colliders` defaults to the map's own shapes; the web app passes ones built from the art's models. */
  constructor(
    public map: HouseMap,
    colliders: Collider[] = mapColliders(map),
  ) {
    this.setMap(map, colliders);
  }

  /** A new house (every round shuffles its props): you stay where you are. */
  setMap(map: HouseMap, colliders: Collider[] = mapColliders(map)) {
    this.map = map;
    this.colliders = colliders;
    this.grid.clear();
    for (const b of colliders) {
      for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++) {
        for (let k = Math.floor(b.z0 / CELL); k <= Math.floor(b.z1 / CELL); k++) {
          const key = cellKey(i, k);
          let list = this.grid.get(key);
          if (!list) this.grid.set(key, (list = []));
          list.push(b);
        }
      }
    }
  }

  /** Colliders that move (other players disguised as props), replaced every frame. */
  setMoving(moving: Collider[]) {
    this.moving = moving;
  }

  /** The colliders in the grid cells a box spans (no moving ones): for the camera's ray. */
  collidersIn(x0: number, z0: number, x1: number, z1: number): Collider[] {
    const out: Collider[] = [];
    const seen = new Set<Collider>();
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let k = Math.floor(z0 / CELL); k <= Math.floor(z1 / CELL); k++) {
        for (const b of this.grid.get(cellKey(i, k)) ?? []) {
          if (seen.has(b)) continue;
          seen.add(b);
          out.push(b);
        }
      }
    }
    return out;
  }

  /** Every collider that could touch the player this step (within `pad` of their square), moving ones included. */
  private around(pad: number): Collider[] {
    const pl = this.player;
    const r = this.half + pad;
    this.nearby.length = 0;
    this.seen.clear();
    for (let i = Math.floor((pl.x - r) / CELL); i <= Math.floor((pl.x + r) / CELL); i++) {
      for (let k = Math.floor((pl.z - r) / CELL); k <= Math.floor((pl.z + r) / CELL); k++) {
        for (const b of this.grid.get(cellKey(i, k)) ?? []) {
          if (this.seen.has(b)) continue;
          this.seen.add(b);
          this.nearby.push(b);
        }
      }
    }
    for (const b of this.moving) this.nearby.push(b);
    return this.nearby;
  }

  /** The collider's half width and height: the avatar's, or the disguise's footprint. */
  get half() {
    return this.size.half;
  }

  get height() {
    return this.size.height;
  }

  /** Become a prop (null: yourself again), facing `facing`. Pushed clear if the new shape overlaps something. */
  become(kind: PropKind | null, facing = this.player.facing) {
    this.disguise = kind;
    if (kind) {
      const b = kindBounds(kind);
      this.size = { half: Math.max(b.w, b.d) / 2, height: b.h };
    } else {
      this.size = { half: PHYS.half, height: PHYS.height };
      this.locked = false;
    }
    this.player.facing = facing;
    this.unstick();
    this.events.push({ type: "become", kind });
  }

  /** Makes a noise from where you are, if the cooldown allows. */
  taunt(): boolean {
    if (this.t < this.tauntReady) return false;
    this.tauntNow(Math.floor(Math.random() * HUNT_TAUNT_SOUNDS));
    return true;
  }

  /** A taunt you didn't choose (the room forces one in the last minute): no cooldown check. */
  tauntNow(sound: number) {
    this.tauntReady = this.t + TAUNT_COOLDOWN;
    this.events.push({ type: "taunt", sound });
  }

  /** 0 → just taunted, 1 → ready again. */
  get tauntCharge() {
    return Math.min(1, 1 - (this.tauntReady - this.t) / TAUNT_COOLDOWN);
  }

  /** Locks (snapping to the nearest quarter turn, like the furniture) or unlocks the disguise's rotation. */
  setLocked(on: boolean) {
    if (!this.disguise) return;
    this.locked = on;
    if (on) this.player.facing = Math.round(this.player.facing / (Math.PI / 2)) * (Math.PI / 2);
  }

  /** Out of anything the collider now overlaps, along whichever way is the shorter way out. */
  private unstick() {
    const pl = this.player;
    const half = this.half;
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const b of this.around(PAD)) {
        if (b.y1 <= pl.y + this.climb(b) || b.y0 >= pl.y + this.height || !this.overlaps(b, half)) continue;
        const left = pl.x + half - b.x0;
        const right = b.x1 - (pl.x - half);
        const back = pl.z + half - b.z0;
        const front = b.z1 - (pl.z - half);
        const dx = left < right ? -left - EPS : right + EPS;
        const dz = back < front ? -back - EPS : front + EPS;
        if (Math.abs(dx) < Math.abs(dz)) pl.x += dx;
        else pl.z += dz;
        moved = true;
      }
      if (!moved) return;
    }
  }

  spawnAt(s: Spot, facing = 0) {
    const pl = this.player;
    Object.assign(pl, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, grounded: true, coyote: 0, buffer: 0, canCut: false, facing });
    this.events.push({ type: "respawn" });
  }

  /** One step. `camYaw` is the camera's yaw, so "forward" is always away from the camera. */
  step(dt: number, input: Input, camYaw: number) {
    this.t += dt;
    const pl = this.player;

    // Camera-relative direction: the camera sits at yaw θ looking back at the player.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let wx = cos * input.x - sin * input.y;
    let wz = -sin * input.x - cos * input.y;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }

    // Sprint: only while moving, and only from a bar that isn't nearly empty.
    const moving = len > 0.1;
    pl.sprinting = input.sprint && moving && pl.stamina > 0 && (pl.sprinting || pl.stamina > 0.2);
    pl.stamina = pl.sprinting ? Math.max(0, pl.stamina - dt / PHYS.sprintFor) : Math.min(1, pl.stamina + dt / PHYS.sprintRefill);
    const speed = PHYS.runSpeed * (pl.sprinting ? PHYS.sprint : 1);
    wx *= speed;
    wz *= speed;

    const accel = pl.grounded ? PHYS.groundAccel : PHYS.airAccel;
    const ddx = wx - pl.vx;
    const ddz = wz - pl.vz;
    const dlen = Math.hypot(ddx, ddz);
    const maxStep = accel * dt;
    if (dlen <= maxStep) {
      pl.vx = wx;
      pl.vz = wz;
    } else {
      pl.vx += (ddx / dlen) * maxStep;
      pl.vz += (ddz / dlen) * maxStep;
    }

    // Jump, with a buffer before landing and coyote time after leaving an edge.
    const pressed = input.jumpPressed;
    if (pressed) pl.buffer = PHYS.jumpBuffer;
    input.jumpPressed = false;
    pl.buffer -= dt;
    pl.coyote = pl.grounded ? PHYS.coyote : pl.coyote - dt;
    if (pl.buffer > 0 && pl.coyote > 0) {
      pl.vy = PHYS.jumpSpeed;
      pl.buffer = 0;
      pl.coyote = 0;
      pl.grounded = false;
      pl.canCut = true;
      this.events.push({ type: "jump" });
    }
    if (!input.jumpHeld && pl.canCut && pl.vy > 0) {
      pl.vy *= PHYS.jumpCut;
      pl.canCut = false;
    }

    // Across, one axis at a time, pushed out of whatever is in the way.
    pl.x += pl.vx * dt;
    this.blockSides("x");
    pl.z += pl.vz * dt;
    this.blockSides("z");

    // Up and down.
    if (!pl.grounded) pl.vy = Math.max(pl.vy - PHYS.gravity * dt, -PHYS.maxFall);
    const prevFeet = pl.y;
    const fallSpeed = -pl.vy;
    pl.y += pl.vy * dt;
    if (pl.vy > 0) this.bumpHead(prevFeet);
    this.land(prevFeet, fallSpeed);

    if (!this.locked && Math.hypot(pl.vx, pl.vz) > 0.4) pl.facing = Math.atan2(pl.vx, pl.vz);
    if (pl.y < FALL_LIMIT) this.spawnAt(this.map.hiderSpawns[0]);
  }

  private overlaps(b: Box, half: number) {
    const pl = this.player;
    return pl.x + half > b.x0 && pl.x - half < b.x1 && pl.z + half > b.z0 && pl.z - half < b.z1;
  }

  /** How high a ledge this collider may be walked up: stairs and floors yes, props no. */
  private climb(b: Collider) {
    return b.step ? PHYS.step : LIP;
  }

  /** Walls and furniture sides. Anything low enough to step onto is left to `land`. */
  private blockSides(axis: "x" | "z") {
    const pl = this.player;
    const half = this.half;
    const top = pl.y + this.height;
    const v = axis === "x" ? pl.vx : pl.vz;
    // Standing still inside something is unstick's job.
    if (v === 0) return;
    for (const b of this.around(PAD)) {
      if (b.y1 <= pl.y + this.climb(b) || b.y0 >= top || !this.overlaps(b, half)) continue;
      // Back out the way we came.
      const lo = axis === "x" ? b.x0 : b.z0;
      const hi = axis === "x" ? b.x1 : b.z1;
      const out = v > 0 ? lo - half - EPS : hi + half + EPS;
      if (axis === "x") {
        pl.x = out;
        pl.vx = 0;
      } else {
        pl.z = out;
        pl.vz = 0;
      }
    }
  }

  private bumpHead(prevFeet: number) {
    const pl = this.player;
    const h = this.height;
    for (const b of this.around(PAD)) {
      if (b.y0 < prevFeet + h - 0.05 || pl.y + h <= b.y0 || !this.overlaps(b, this.half * HEAD)) continue;
      pl.y = b.y0 - h;
      pl.vy = 0;
      pl.canCut = false;
    }
  }

  /** Lands on (or steps up onto, or follows down) the highest surface underfoot. */
  private land(prevFeet: number, fallSpeed: number) {
    const pl = this.player;
    let support = -Infinity;
    for (const b of this.around(PAD)) {
      if (b.y1 > prevFeet + this.climb(b) || b.y1 <= support || !this.overlaps(b, this.half)) continue;
      support = b.y1;
    }
    if (pl.vy <= 0 && pl.y <= support) {
      if (!pl.grounded && fallSpeed > 2) this.events.push({ type: "land", speed: fallSpeed });
      pl.y = support;
      pl.vy = 0;
      pl.grounded = true;
    } else if (pl.grounded && pl.vy <= 0 && pl.y - support <= PHYS.step) {
      // Walking down steps: stay on them instead of hopping off each one.
      pl.y = support;
      pl.vy = 0;
    } else {
      pl.grounded = false;
    }
  }
}

/**
 * How far a ray goes before it hits one of `boxes` (Infinity if it doesn't within `max`). Boxes
 * smaller than `minSize` across are ignored: the camera shouldn't snag on chair legs. Allocates
 * nothing: it runs every frame.
 */
export function rayBoxes(boxes: Iterable<Box>, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number, minSize = 0): number {
  let best = max;
  for (const b of boxes) {
    if (minSize > 0 && b.x1 - b.x0 < minSize && b.z1 - b.z0 < minSize) continue;
    const t = slab(ox, dx, b.x0, b.x1, 0, best);
    if (t === null) continue;
    const ty = slab(oy, dy, b.y0, b.y1, t[0], t[1]);
    if (ty === null) continue;
    const tz = slab(oz, dz, b.z0, b.z1, ty[0], ty[1]);
    if (tz !== null && tz[0] < best) best = tz[0];
  }
  return best === max ? Infinity : best;
}

const span: [number, number] = [0, 0];

/** One axis of the slab test: the part of [t0, t1] the ray spends between lo and hi, or null. */
function slab(o: number, d: number, lo: number, hi: number, t0: number, t1: number): [number, number] | null {
  if (Math.abs(d) < 1e-9) return o < lo || o > hi ? null : ((span[0] = t0), (span[1] = t1), span);
  let a = (lo - o) / d;
  let c = (hi - o) / d;
  if (a > c) [a, c] = [c, a];
  span[0] = Math.max(t0, a);
  span[1] = Math.min(t1, c);
  return span[0] > span[1] ? null : span;
}
