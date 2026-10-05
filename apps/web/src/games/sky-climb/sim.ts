// The climb itself, without any rendering: platforms that move, crumble and vanish, the
// hazards, the coins, and the player's platformer physics. The scene reads this state
// every frame to draw it.
//
// Platforms are one-way: you jump up through them and land on top, the classic platformer
// rule. That keeps collision to "did the feet cross the top surface this frame?".
import type { GhostPose } from "@shadow/shared";
import { CHECKPOINTS, FLOORS, PHYS, TOWER, zoneOf } from "./config";
import { floorAt, type Coin, type Hazard, type Platform, type Tower } from "./tower";

export interface PlatformState {
  p: Platform;
  /** Current centre of the top surface. */
  x: number;
  top: number;
  z: number;
  /** How far it moved this step, to carry whoever stands on it. */
  dx: number;
  dy: number;
  dz: number;
  solid: boolean;
  /** Vanishing platforms: about to disappear. */
  warn: boolean;
  /** Crumbling platforms: when someone first stood on it. */
  crumbleAt: number | null;
  /** Springs: when it last launched someone. */
  springAt: number;
}

export interface HazardState {
  h: Hazard;
  x: number;
  y: number;
  z: number;
  /** Spikes: 0 hidden … 1 fully out (deadly from 0.6). */
  extend: number;
  spin: number;
}

export type SimEvent =
  | { type: "jump" | "spring" | "die" | "respawn" | "summit" }
  | { type: "land"; speed: number }
  | { type: "coin"; id: number }
  | { type: "floor"; floor: number }
  | { type: "checkpoint"; floor: number };

export interface Input {
  /** Joystick or keys: x right, y forward (into the screen), each −1…1. */
  x: number;
  y: number;
  jumpHeld: boolean;
  /** Set when jump goes down; the sim clears it once read. */
  jumpPressed: boolean;
}

/** Below this the island catches you at the start. */
const ISLAND_TOP = -0.65;
const ISLAND_RADIUS = 9.5;
const DEATH_TIME = 1.1;
const GUST = { period: 7, length: 2.2, accel: 9 };

export class Sim {
  t = 0;
  platforms: PlatformState[];
  hazards: HazardState[];
  coins: Coin[];
  taken = new Set<number>();
  events: SimEvent[] = [];
  /** 0…1 strength of the current wind gust (windy zones only). */
  gust = 0;

  player = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    ground: null as PlatformState | null,
    coyote: 0,
    buffer: 0,
    canCut: false,
    facing: 0,
    /** Seconds left of the death animation; 0 while alive. */
    dead: 0,
    /** Highest floor stood on this run. */
    floor: 0,
    checkpoint: 0,
    /** Fractional floor at the player's height (for the sky, culling, the HUD bar). */
    height: 0,
    summit: false,
  };

  constructor(public tower: Tower) {
    this.platforms = tower.platforms.map((p) => ({
      p,
      x: p.x,
      top: p.top,
      z: p.z,
      dx: 0,
      dy: 0,
      dz: 0,
      solid: true,
      warn: false,
      crumbleAt: null,
      springAt: -10,
    }));
    this.hazards = tower.hazards.map((h) => ({ h, x: 0, y: 0, z: 0, extend: 0, spin: 0 }));
    this.coins = tower.coins;
    this.respawn(false);
    this.updateWorld(0);
  }

  /** Advances the world only (the menu shows the tower alive behind it). */
  idle(dt: number) {
    this.t += dt;
    this.updateWorld(dt);
    const pl = this.player;
    if (pl.ground) {
      pl.x += pl.ground.dx;
      pl.y += pl.ground.dy;
      pl.z += pl.ground.dz;
    }
  }

  step(dt: number, input: Input) {
    this.t += dt;
    this.updateWorld(dt);
    const pl = this.player;

    if (pl.dead > 0) {
      pl.dead -= dt;
      if (pl.dead <= 0) this.respawn(true);
      input.jumpPressed = false;
      return;
    }
    if (pl.summit) {
      pl.vx = pl.vz = 0;
      input.jumpPressed = false;
      return;
    }

    // Screen-relative movement: the camera always looks in at the column, so "forward" is
    // towards it and "right" runs around the tower.
    const dist = Math.hypot(pl.x, pl.z) || 1;
    const fx = -pl.x / dist;
    const fz = -pl.z / dist;
    let wx = -fz * input.x + fx * input.y;
    let wz = fx * input.x + fz * input.y;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }
    wx *= PHYS.runSpeed;
    wz *= PHYS.runSpeed;

    const ground = pl.grounded ? pl.ground : null;
    const accel = pl.grounded ? (ground?.p.ice ? PHYS.iceAccel : PHYS.groundAccel) : PHYS.airAccel;
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

    // Wind pushes outwards, off the tower.
    if (this.gust > 0) {
      pl.vx += (-fx) * GUST.accel * this.gust * dt;
      pl.vz += (-fz) * GUST.accel * this.gust * dt;
    }

    // Jump, with a buffer before landing and coyote time after leaving an edge.
    if (input.jumpPressed) pl.buffer = PHYS.jumpBuffer;
    input.jumpPressed = false;
    pl.buffer -= dt;
    pl.coyote = pl.grounded ? PHYS.coyote : pl.coyote - dt;
    if (pl.buffer > 0 && pl.coyote > 0) {
      pl.vy = PHYS.jumpSpeed;
      pl.buffer = 0;
      pl.coyote = 0;
      pl.grounded = false;
      pl.ground = null;
      pl.canCut = true;
      this.events.push({ type: "jump" });
    }
    if (!input.jumpHeld && pl.canCut && pl.vy > 0) {
      pl.vy *= PHYS.jumpCut;
      pl.canCut = false;
    }

    // Ride whatever we stand on, conveyors included.
    if (ground) {
      pl.x += ground.dx;
      pl.y += ground.dy;
      pl.z += ground.dz;
      if (ground.p.belt) {
        pl.x += Math.cos(ground.p.yaw) * ground.p.belt * dt;
        pl.z += -Math.sin(ground.p.yaw) * ground.p.belt * dt;
      }
    }

    if (!pl.grounded) pl.vy = Math.max(pl.vy - PHYS.gravity * dt, -PHYS.maxFall);
    const prevFeet = pl.y;
    const fallSpeed = -pl.vy;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    pl.z += pl.vz * dt;

    // The column is solid all the way up.
    const r = Math.hypot(pl.x, pl.z);
    const minR = TOWER.coreRadius + PHYS.radius;
    if (r < minR && r > 0) {
      pl.x *= minR / r;
      pl.z *= minR / r;
    }

    this.land(prevFeet, fallSpeed);
    this.touchHazards();
    this.collectCoins();

    if (Math.hypot(pl.vx, pl.vz) > 0.4) pl.facing = Math.atan2(pl.vx, pl.vz);
    pl.height = floorAt(this.tower, pl.y);
    if (pl.y < this.tower.floorTops[pl.checkpoint] - PHYS.fallDepth) this.die();
  }

  private land(prevFeet: number, fallSpeed: number) {
    const pl = this.player;
    const wasGrounded = pl.grounded;
    const previous = pl.ground;
    pl.grounded = false;
    pl.ground = null;
    if (pl.vy > 0) return;

    let best: PlatformState | null = null;
    for (const ps of this.platforms) {
      if (!ps.solid || Math.abs(ps.top - pl.y) > 3) continue;
      const prevTop = ps.top - ps.dy;
      const stick = wasGrounded && previous === ps ? 0.15 : 0;
      if (prevFeet < prevTop - 0.08 || pl.y > ps.top + stick) continue;
      // Into the platform's own frame: local x runs along it, local z across.
      const c = Math.cos(ps.p.yaw);
      const s = Math.sin(ps.p.yaw);
      const rx = pl.x - ps.x;
      const rz = pl.z - ps.z;
      const lx = rx * c - rz * s;
      const lz = rx * s + rz * c;
      const edge = PHYS.radius * 0.35;
      if (Math.abs(lx) > ps.p.w / 2 + edge || Math.abs(lz) > ps.p.d / 2 + edge) continue;
      if (!best || ps.top > best.top) best = ps;
    }

    if (best) {
      pl.y = best.top;
      pl.vy = 0;
      pl.grounded = true;
      pl.ground = best;
      pl.canCut = false;
      if (!wasGrounded) this.events.push({ type: "land", speed: fallSpeed });
      this.reach(best);
      if (best.p.kind === "spring") {
        pl.vy = PHYS.springSpeed;
        pl.grounded = false;
        pl.ground = null;
        best.springAt = this.t;
        this.events.push({ type: "spring" });
      } else if (best.p.kind === "crumble" && best.crumbleAt === null) {
        best.crumbleAt = this.t;
      }
      return;
    }

    // The island at the foot of the tower.
    if (prevFeet >= ISLAND_TOP - 0.05 && pl.y <= ISLAND_TOP && Math.hypot(pl.x, pl.z) < ISLAND_RADIUS) {
      pl.y = ISLAND_TOP;
      pl.vy = 0;
      pl.grounded = true;
      if (!wasGrounded) this.events.push({ type: "land", speed: fallSpeed });
    }
  }

  /** Progress: a new highest floor, a checkpoint, the summit. */
  private reach(ps: PlatformState) {
    const pl = this.player;
    const floor = ps.p.floor;
    if (floor <= pl.floor) return;
    pl.floor = floor;
    this.events.push({ type: "floor", floor });
    if (ps.p.checkpoint && floor > pl.checkpoint) {
      pl.checkpoint = floor;
      if (floor < FLOORS) this.events.push({ type: "checkpoint", floor });
    }
    if (floor === FLOORS) {
      pl.summit = true;
      this.events.push({ type: "summit" });
    }
  }

  private touchHazards() {
    const pl = this.player;
    for (const hs of this.hazards) {
      if (Math.abs(hs.y - pl.y) > 2.5) continue;
      if (hs.h.type === "saw") {
        const d = Math.hypot(hs.x - pl.x, hs.y - (pl.y + 0.45), hs.z - pl.z);
        if (d < 0.62) return this.die();
      } else if (hs.extend > 0.6 && pl.grounded && pl.ground?.p.id === hs.h.platform) {
        if (Math.hypot(hs.x - pl.x, hs.z - pl.z) < 0.55) return this.die();
      }
    }
  }

  private collectCoins() {
    const pl = this.player;
    for (const c of this.coins) {
      if (this.taken.has(c.id) || Math.abs(c.y - pl.y) > 2) continue;
      if (Math.hypot(c.x - pl.x, c.y - (pl.y + 0.45), c.z - pl.z) < 0.7) {
        this.taken.add(c.id);
        this.events.push({ type: "coin", id: c.id });
      }
    }
  }

  die() {
    const pl = this.player;
    if (pl.dead > 0 || pl.summit) return;
    pl.dead = DEATH_TIME;
    pl.vx = pl.vz = 0;
    pl.vy = Math.min(pl.vy, 0);
    this.events.push({ type: "die" });
  }

  /** Back to the last checkpoint, standing still. */
  respawn(announce: boolean) {
    const pl = this.player;
    const ps = this.platforms[pl.checkpoint];
    pl.x = ps.x;
    pl.y = ps.top;
    pl.z = ps.z;
    pl.vx = pl.vy = pl.vz = 0;
    pl.grounded = true;
    pl.ground = ps;
    pl.dead = 0;
    pl.coyote = 0;
    pl.buffer = 0;
    // Face along the way up.
    const next = this.platforms[Math.min(pl.checkpoint + 1, this.platforms.length - 1)];
    pl.facing = Math.atan2(next.x - ps.x, next.z - ps.z);
    pl.height = floorAt(this.tower, pl.y);
    if (announce) this.events.push({ type: "respawn" });
  }

  private updateWorld(dt: number) {
    const t = this.t;
    for (const ps of this.platforms) {
      const p = ps.p;
      let x = p.x;
      let top = p.top;
      let z = p.z;
      if (p.motion) {
        const m = p.motion;
        const s = Math.sin((2 * Math.PI * t) / m.period + m.phase) * m.amp;
        x += m.ax * s;
        top += m.ay * s;
        z += m.az * s;
      }
      ps.dx = x - ps.x;
      ps.dy = top - ps.top;
      ps.dz = z - ps.z;
      ps.x = x;
      ps.top = top;
      ps.z = z;

      if (p.vanish) {
        const phase = (t + p.vanish.phase) % p.vanish.period;
        ps.solid = phase < p.vanish.on;
        ps.warn = ps.solid && phase > p.vanish.on - 0.8;
      } else if (ps.crumbleAt !== null) {
        const since = t - ps.crumbleAt;
        ps.solid = since < 0.65;
        if (since > 3.5) {
          ps.crumbleAt = null;
          ps.solid = true;
        }
      }
    }
    // Riders lose their footing when the floor goes.
    const pl = this.player;
    if (pl.ground && !pl.ground.solid) {
      pl.grounded = false;
      pl.ground = null;
    }

    for (const hs of this.hazards) {
      const ps = this.platforms[hs.h.platform];
      const ax = Math.cos(ps.p.yaw);
      const az = -Math.sin(ps.p.yaw);
      if (hs.h.type === "saw") {
        const s = Math.sin((2 * Math.PI * (t + hs.h.phase)) / hs.h.period) * hs.h.amp;
        hs.x = ps.x + ax * s;
        hs.y = ps.top + 0.5;
        hs.z = ps.z + az * s;
        hs.spin += dt * 12;
      } else {
        // Out for a third of the cycle, with a short warning poke before.
        const c = ((t + hs.h.phase) % hs.h.period) / hs.h.period;
        const target = c > 0.55 && c < 0.88 ? 1 : c > 0.42 && c <= 0.55 ? 0.3 : 0;
        hs.extend += (target - hs.extend) * Math.min(1, dt * 18);
        hs.x = ps.x;
        hs.y = ps.top;
        hs.z = ps.z;
      }
    }

    // Gusts in windy zones: a few seconds of wind every so often.
    const zone = zoneOf(Math.floor(this.player.height));
    if (zone.wind) {
      const c = t % GUST.period;
      const target = c < GUST.length ? 1 : 0;
      this.gust += (target - this.gust) * Math.min(1, dt * 3);
    } else {
      this.gust = Math.max(0, this.gust - dt * 2);
    }
  }
}

export const nextCheckpointAfter = (floor: number) => CHECKPOINTS.find((c) => c > floor) ?? FLOORS;

/** What the climber is doing, for its animation and for ghosts. */
export function poseOf(pl: Sim["player"], cheering = false): GhostPose {
  if (pl.dead > 0) return "die";
  if (pl.summit) return "cheer";
  if (!pl.grounded) return pl.vy > 0 ? "jump" : "fall";
  const speed = Math.hypot(pl.vx, pl.vz);
  if (speed > 3.6) return "sprint";
  if (speed > 0.4) return "walk";
  return cheering ? "cheer" : "idle";
}
