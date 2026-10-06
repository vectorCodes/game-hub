// The climb itself, without any rendering: platforms that move, crumble and vanish, the
// hazards, the coins, and the player's platformer physics. The scene reads this state
// every frame to draw it.
//
// Platforms are one-way from below: you jump up through them and land on top, the classic
// platformer rule. Their sides are solid, though, so you can't walk into a block.
import type { GhostPose } from "@shadow/shared";
import {
  CANNON,
  CHECKPOINTS,
  FLOORS,
  PHYS,
  POWER,
  POWERUPS,
  POWERUP_KINDS,
  TOWER,
  UPDRAFT,
  zoneIndexOf,
  zoneOf,
  type CannonGrade,
  type PowerupKind,
  type SetPieceId,
} from "./config";
import { rulesOf, type TwistRules } from "./twists";
import { arcEnd, cannonPoint, floorAt, type ArcEnd, type Cannon, type Coin, type Hazard, type Platform, type Powerup, type Tower } from "./tower";

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
  | { type: "jump" | "airjump" | "spring" | "die" | "respawn" | "summit" | "shield" }
  | { type: "powerup"; kind: PowerupKind; id: number }
  | { type: "expire"; kind: PowerupKind }
  | { type: "land"; speed: number }
  | { type: "coin"; id: number }
  | { type: "floor"; floor: number }
  | { type: "checkpoint"; floor: number }
  | { type: "cannonLoad" }
  | { type: "cannonFire" | "cannonLand"; grade: CannonGrade; lift: number }
  | { type: "setpiece" | "cleared"; id: SetPieceId }
  | { type: "strike" };

/** In a cannon: aiming (the meter swinging), then flying. */
export interface CannonRide {
  cannon: Cannon;
  phase: "load" | "fly";
  /** When this phase began. */
  at: number;
  /** The power meter, 0…1 (frozen once fired). */
  meter: number;
  grade: CannonGrade;
  /** The flight. */
  to: ArcEnd;
  target: number;
  duration: number;
}

/** The power meter's reading: a triangle wave, 0 → 1 → 0 each period. */
export const meterAt = (elapsed: number, period: number) => {
  const x = (elapsed / period) % 1;
  return 1 - Math.abs(x * 2 - 1);
};

export const gradeOf = (meter: number): CannonGrade => (meter >= CANNON.perfect ? "perfect" : meter >= CANNON.good ? "good" : "weak");

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
/** Wind: a gust every `period` seconds, lasting `length`. It pushes hard in the air but only gently on a platform, so you can always stand your ground. */
const GUST = { period: 9, length: 1.8, accel: 4, grounded: 0.35 };

type Phys = { -readonly [K in keyof typeof PHYS]: number };

export class Sim {
  t = 0;
  /** The tower's twist, and the physics it plays with. */
  rules: TwistRules;
  phys: Phys;
  platforms: PlatformState[];
  hazards: HazardState[];
  coins: Coin[];
  taken = new Set<number>();
  powerups: Powerup[];
  /** Orbs picked up since the last respawn: dying puts them back. */
  collected = new Set<number>();
  /** Seconds left of each power-up (0 = not active). */
  effects: Record<PowerupKind, number> = { feather: 0, doubleJump: 0, shield: 0, magnet: 0 };
  /** Coins the magnet has set flying, at their current position. */
  pulled = new Map<number, { x: number; y: number; z: number }>();
  /** Invulnerable for this long after a shield absorbs a hit. */
  grace = 0;
  events: SimEvent[] = [];
  /** 0…1 strength of the current wind gust (windy zones only). */
  gust = 0;
  /** Riding a cannon, if any. */
  cannon: CannonRide | null = null;
  private cannonAt = new Map<number, Cannon>();
  /** Set-pieces announced and cleared this run. */
  private entered = new Set<SetPieceId>();
  private cleared = new Set<SetPieceId>();
  /** Lightning Sprint platforms that were solid last step, to hear them go. */
  private struck = new Set<number>();
  private flight = { x: 0, y: 0, z: 0 };

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
    /** The mid-air jump (double jump) is spent until the next landing. */
    airJumped: false,
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
    this.rules = rulesOf(tower.twist);
    const phys: Phys = { ...PHYS };
    for (const [key, scale] of Object.entries(this.rules.phys ?? {})) phys[key as keyof Phys] *= scale ?? 1;
    this.phys = phys;
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
    this.powerups = tower.powerups;
    for (const c of tower.cannons) this.cannonAt.set(c.floor, c);
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

    this.tickEffects(dt);
    if (this.cannon) return this.ride(dt, input);

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
    wx *= this.phys.runSpeed;
    wz *= this.phys.runSpeed;

    const ground = pl.grounded ? pl.ground : null;
    const accel = pl.grounded ? (ground?.p.ice ? this.phys.iceAccel : this.phys.groundAccel) : this.phys.airAccel;
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

    // Rising air lifts whoever is in it (and shelters them from the wind).
    const lifted = !pl.grounded && this.inUpdraft();
    if (lifted) pl.vy = Math.min(UPDRAFT.maxRise, pl.vy + UPDRAFT.accel * dt);

    // Wind pushes outwards, off the tower.
    if (this.gust > 0 && !lifted) {
      const push = GUST.accel * this.gust * (pl.grounded ? GUST.grounded : 1) * dt;
      pl.vx += -fx * push;
      pl.vz += -fz * push;
    }

    // Jump, with a buffer before landing and coyote time after leaving an edge.
    const pressed = input.jumpPressed;
    if (pressed) pl.buffer = this.phys.jumpBuffer;
    input.jumpPressed = false;
    pl.buffer -= dt;
    pl.coyote = pl.grounded ? this.phys.coyote : pl.coyote - dt;
    if (pl.buffer > 0 && pl.coyote > 0) {
      pl.vy = this.phys.jumpSpeed;
      pl.buffer = 0;
      pl.coyote = 0;
      pl.grounded = false;
      pl.ground = null;
      pl.canCut = true;
      this.events.push({ type: "jump" });
    } else if (pressed && !pl.grounded && pl.coyote <= 0 && this.effects.doubleJump > 0 && !pl.airJumped) {
      // Double jump: one more in the air, recharged on landing.
      pl.vy = this.phys.jumpSpeed * POWER.airJump;
      pl.buffer = 0;
      pl.airJumped = true;
      pl.canCut = true;
      this.events.push({ type: "airjump" });
    }
    if (!input.jumpHeld && pl.canCut && pl.vy > 0) {
      pl.vy *= this.phys.jumpCut;
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

    if (!pl.grounded && !lifted) {
      // Feather: while falling with jump held, gravity eases and the fall speed is capped.
      const float = this.effects.feather > 0 && input.jumpHeld && pl.vy < 0;
      const gravity = float ? this.phys.gravity * POWER.featherGravity : this.phys.gravity;
      pl.vy = Math.max(pl.vy - gravity * dt, float ? -POWER.featherMaxFall : -this.phys.maxFall);
    }
    const prevFeet = pl.y;
    const prevX = pl.x;
    const prevZ = pl.z;
    const fallSpeed = -pl.vy;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    pl.z += pl.vz * dt;

    // The column is solid all the way up.
    const r = Math.hypot(pl.x, pl.z);
    const minR = TOWER.coreRadius + this.phys.radius;
    if (r < minR && r > 0) {
      pl.x *= minR / r;
      pl.z *= minR / r;
    }

    this.blockSides(prevX, prevZ);
    this.land(prevFeet, fallSpeed);
    if (pl.grounded) pl.airJumped = false;
    this.touchHazards();
    this.collectCoins(dt);
    this.collectPowerups();
    this.boardCannon();

    if (Math.hypot(pl.vx, pl.vz) > 0.4) pl.facing = Math.atan2(pl.vx, pl.vz);
    pl.height = floorAt(this.tower, pl.y);
    if (pl.y < this.tower.floorTops[pl.checkpoint] - this.phys.fallDepth) this.die();
  }

  /**
   * Pushes the player back out of any platform they walked or fell into from the side.
   * Only entries from outside the footprint count, so jumping up through from below
   * still works.
   */
  private blockSides(prevX: number, prevZ: number) {
    const pl = this.player;
    for (const ps of this.platforms) {
      if (!ps.solid || Math.abs(ps.top - pl.y) > 3) continue;
      // Feet near the top are the landing's business; the body has to overlap the slab.
      if (pl.y >= ps.top - 0.08 || pl.y + this.phys.height <= ps.top - ps.p.h) continue;
      const c = Math.cos(ps.p.yaw);
      const s = Math.sin(ps.p.yaw);
      const hw = ps.p.w / 2 + this.phys.radius;
      const hd = ps.p.d / 2 + this.phys.radius;
      const rx = pl.x - ps.x;
      const rz = pl.z - ps.z;
      let lx = rx * c - rz * s;
      let lz = rx * s + rz * c;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;
      // Where we were last step, relative to where the platform was.
      const px = prevX - (ps.x - ps.dx);
      const pz = prevZ - (ps.z - ps.dz);
      const plx = px * c - pz * s;
      const plz = px * s + pz * c;
      const outX = Math.abs(plx) >= hw;
      const outZ = Math.abs(plz) >= hd;
      if (!outX && !outZ) continue;
      // Out through the face we came in by (the shallower one if we cut a corner).
      const alongX = outX && (!outZ || hw - Math.abs(lx) < hd - Math.abs(lz));
      let nx: number;
      let nz: number;
      if (alongX) {
        lx = Math.sign(plx) * hw;
        nx = c;
        nz = -s;
      } else {
        lz = Math.sign(plz) * hd;
        nx = s;
        nz = c;
      }
      pl.x = ps.x + lx * c + lz * s;
      pl.z = ps.z - lx * s + lz * c;
      // Lose the velocity heading into the face.
      const into = pl.vx * nx + pl.vz * nz;
      const sign = alongX ? Math.sign(plx) : Math.sign(plz);
      if (into * sign < 0) {
        pl.vx -= into * nx;
        pl.vz -= into * nz;
      }
    }
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
      const edge = this.phys.radius * 0.35;
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
        pl.vy = this.phys.springSpeed;
        pl.grounded = false;
        pl.ground = null;
        best.springAt = this.t;
        this.events.push({ type: "spring" });
      } else if (best.p.chain !== undefined && best.crumbleAt === null) {
        this.collapseFrom(best);
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
    // The highest checkpoint at or below: a cannon shot over one still saves it.
    const checkpoint = CHECKPOINTS.filter((c) => c <= floor).pop() ?? 0;
    if (checkpoint > pl.checkpoint) {
      pl.checkpoint = checkpoint;
      if (checkpoint < FLOORS) this.events.push({ type: "checkpoint", floor: checkpoint });
    }
    for (const sp of this.tower.setPieces) {
      if (floor >= sp.from && floor <= sp.to && !this.entered.has(sp.id)) {
        this.entered.add(sp.id);
        this.events.push({ type: "setpiece", id: sp.id });
      } else if (floor > sp.to && this.entered.has(sp.id) && !this.cleared.has(sp.id)) {
        this.cleared.add(sp.id);
        this.events.push({ type: "cleared", id: sp.id });
      }
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
        if (d < 0.62) return this.hit();
      } else if (hs.extend > 0.6 && pl.grounded && pl.ground?.p.id === hs.h.platform) {
        if (Math.hypot(hs.x - pl.x, hs.z - pl.z) < 0.55) return this.hit();
      }
    }
  }

  private collectCoins(dt: number) {
    const pl = this.player;
    const magnet = this.effects.magnet > 0;
    for (const c of this.coins) {
      if (this.taken.has(c.id)) continue;
      let pos = this.pulled.get(c.id);
      if (!pos) {
        if (Math.abs(c.y - pl.y) > 3.6) continue;
        if (magnet && Math.hypot(c.x - pl.x, c.y - (pl.y + 0.45), c.z - pl.z) < POWER.magnetRadius) {
          pos = { x: c.x, y: c.y, z: c.z };
          this.pulled.set(c.id, pos);
        }
      }
      let { x, y, z } = pos ?? c;
      if (pos) {
        // Flies in at a steady speed; a coin that's been called keeps coming.
        const dx = pl.x - x;
        const dy = pl.y + 0.45 - y;
        const dz = pl.z - z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const step = Math.min(d, POWER.magnetSpeed * dt);
        pos.x = x += (dx / d) * step;
        pos.y = y += (dy / d) * step;
        pos.z = z += (dz / d) * step;
      }
      if (Math.hypot(x - pl.x, y - (pl.y + 0.45), z - pl.z) < 0.7) {
        this.taken.add(c.id);
        this.pulled.delete(c.id);
        this.events.push({ type: "coin", id: c.id });
      }
    }
  }

  private collectPowerups() {
    const pl = this.player;
    for (const o of this.powerups) {
      if (this.collected.has(o.id) || Math.abs(o.y - pl.y) > 2) continue;
      if (Math.hypot(o.x - pl.x, o.y - (pl.y + 0.45), o.z - pl.z) < POWER.pickupRadius) {
        this.collected.add(o.id);
        // Picking up one that's already running just refreshes it.
        this.effects[o.kind] = POWERUPS[o.kind].duration;
        this.events.push({ type: "powerup", kind: o.kind, id: o.id });
      }
    }
  }

  private tickEffects(dt: number) {
    this.grace = Math.max(0, this.grace - dt);
    for (const kind of POWERUP_KINDS) {
      if (this.effects[kind] <= 0) continue;
      this.effects[kind] -= dt;
      if (this.effects[kind] <= 0) {
        this.effects[kind] = 0;
        this.events.push({ type: "expire", kind });
      }
    }
  }

  /** A saw or spike touched the climber: the shield takes it, otherwise it's a fall. */
  private hit() {
    if (this.grace > 0) return;
    if (this.effects.shield > 0) {
      this.effects.shield = 0;
      this.grace = POWER.shieldGrace;
      this.events.push({ type: "shield" });
      return;
    }
    this.die();
  }

  /** Standing at a cannon: climb in. */
  private boardCannon() {
    const pl = this.player;
    if (!pl.grounded || !pl.ground) return;
    const c = this.cannonAt.get(pl.ground.p.id);
    if (!c || Math.hypot(pl.x - c.x, pl.z - c.z) > CANNON.padRadius) return;
    this.cannon = { cannon: c, phase: "load", at: this.t, meter: 0, grade: "weak", to: c.from, target: c.floor, duration: 1 };
    pl.vx = pl.vy = pl.vz = 0;
    // A jump pressed on the way in mustn't go off when the shot lands.
    pl.buffer = 0;
    pl.coyote = 0;
    pl.facing = c.facing;
    this.events.push({ type: "cannonLoad" });
  }

  /** Aiming, then the scripted flight along the arc. */
  private ride(dt: number, input: Input) {
    const pl = this.player;
    const ride = this.cannon!;
    const c = ride.cannon;
    const pressed = input.jumpPressed;
    input.jumpPressed = false;
    if (ride.phase === "load") {
      pl.x = c.x;
      pl.y = c.y;
      pl.z = c.z;
      const elapsed = this.t - ride.at;
      ride.meter = meterAt(elapsed, c.period);
      if ((pressed && elapsed > CANNON.arm) || elapsed > CANNON.autoFire) {
        const grade = gradeOf(ride.meter);
        const target = c.targets[grade];
        Object.assign(ride, { phase: "fly", at: this.t, grade, target, to: arcEnd(this.platforms[target].p), duration: CANNON.flight[grade] });
        pl.grounded = false;
        pl.ground = null;
        this.events.push({ type: "cannonFire", grade, lift: target - c.floor });
      }
      return;
    }

    const u = (this.t - ride.at) / ride.duration;
    if (u >= 1) {
      const ps = this.platforms[ride.target];
      pl.x = ps.x;
      pl.y = ps.top;
      pl.z = ps.z;
      pl.vx = pl.vz = 0;
      pl.vy = 0;
      pl.grounded = true;
      pl.ground = ps;
      pl.airJumped = false;
      this.cannon = null;
      this.events.push({ type: "land", speed: 14 });
      this.events.push({ type: "cannonLand", grade: ride.grade, lift: ride.target - c.floor });
      this.reach(ps);
    } else {
      const at = cannonPoint(c.from, ride.to, u, this.flight);
      pl.vx = (at.x - pl.x) / dt;
      pl.vy = (at.y - pl.y) / dt;
      pl.vz = (at.z - pl.z) / dt;
      pl.x = at.x;
      pl.y = at.y;
      pl.z = at.z;
      if (Math.hypot(pl.vx, pl.vz) > 0.4) pl.facing = Math.atan2(pl.vx, pl.vz);
      this.collectCoins(dt);
    }
    pl.height = floorAt(this.tower, pl.y);
  }

  /** Inside an updraft column? */
  private inUpdraft() {
    const pl = this.player;
    for (const u of this.tower.updrafts) {
      if (pl.y < u.bottom || pl.y > u.top) continue;
      if (Math.hypot(pl.x - u.x, pl.z - u.z) < u.radius) return true;
    }
    return false;
  }

  /**
   * The collapsing bridge: this plank and every one after it fall in turn, the first after
   * the bridge's opening grace, the rest at their spacing (whichever plank started it).
   */
  private collapseFrom(ps: PlatformState) {
    const planks = this.platforms.filter((o) => o.p.setPiece === ps.p.setPiece && o.p.chain !== undefined);
    const grace = planks[0].p.chain!;
    for (const plank of planks) {
      if (plank.p.floor < ps.p.floor || plank.crumbleAt !== null) continue;
      // A crumbling platform shakes from crumbleAt and falls 0.65 s later.
      plank.crumbleAt = this.t + grace + (plank.p.chain! - ps.p.chain!) - 0.65;
    }
  }

  die() {
    const pl = this.player;
    if (pl.dead > 0 || pl.summit) return;
    pl.dead = DEATH_TIME;
    pl.vx = pl.vz = 0;
    pl.vy = Math.min(pl.vy, 0);
    for (const kind of POWERUP_KINDS) this.effects[kind] = 0;
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
    pl.airJumped = false;
    // A fresh start for the section: orbs and flying coins go back where they were.
    for (const kind of POWERUP_KINDS) this.effects[kind] = 0;
    this.grace = 0;
    this.cannon = null;
    this.collected.clear();
    this.pulled.clear();
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
        if (p.strike) {
          // A thunderclap as each one goes, if it's near enough to hear.
          if (!ps.solid && this.struck.has(p.id) && Math.abs(p.floor - this.player.height) < 2.5) this.events.push({ type: "strike" });
          if (ps.solid) this.struck.add(p.id);
          else this.struck.delete(p.id);
        }
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
    const floor = Math.floor(this.player.height);
    const windFrom = this.rules.windFrom;
    if (zoneOf(floor).wind || (windFrom !== undefined && zoneIndexOf(floor) >= windFrom && zoneOf(floor).id !== "summit")) {
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
