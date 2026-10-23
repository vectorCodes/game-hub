// Bumper Arena's physics: rings are circles sliding on the arena floor (x, z), plus a simple
// fall once they leave it. No physics engine: circle-vs-circle hits, a shrinking edge, and
// timers. Pure and framework-free, so the same code can run the solo game in the browser
// and, later, a room on the server. Units are metres and seconds; +y is up.
import { arenaRadius, BUMPER_COUNTDOWN_SECONDS, BUMPER_TUNING, type BumperMap, type BumperTuning } from "./bumper";

/** What a ring's driver wants this step. `x`/`z` is the stick on the floor plane, length ≤ 1. */
export interface BumperInput {
  x: number;
  z: number;
  /** Pressed this step (not held): dashes if the dash is ready. */
  dash: boolean;
  /** Held. */
  brace: boolean;
}

export type RingState = "in" | "falling" | "out";

export interface Ring {
  id: string;
  name: string;
  bot: boolean;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  /** Heading (radians, 0 = +z), for drawing. */
  facing: number;
  /** 0–wobbleMax %: the more you've been hit, the further you fly. */
  wobble: number;
  /** Seconds left of the current dash. */
  dashLeft: number;
  dashCooldown: number;
  bracing: boolean;
  /** Seconds braced so far, while bracing. */
  braceHeld: number;
  braceCooldown: number;
  state: RingState;
  /** Round time when it started falling. */
  fellAt: number | null;
  lastHitBy: string | null;
  lastHitAt: number;
  /** Last time anything bumped it (for the wobble drain). */
  touchedAt: number;
  kos: number;
  input: BumperInput;
}

export type BumperEvent =
  | { type: "start" }
  | { type: "dash"; id: string }
  | { type: "hit"; a: string; b: string; x: number; z: number; /** Closing speed over top speed. */ power: number; dash: boolean }
  | { type: "fall"; id: string }
  | { type: "out"; id: string; by: string | null }
  | { type: "warn" }
  | { type: "drop"; radius: number }
  | { type: "over"; winner: string | null };

export type BumperPhase = "countdown" | "play" | "over";

export interface BumperEntrant {
  id: string;
  name: string;
  bot: boolean;
}

const NO_INPUT: BumperInput = { x: 0, z: 0, dash: false, brace: false };

export const ringMass = (r: Ring, tuning: BumperTuning) => (r.bracing ? tuning.braceMass : 1);

export class BumperSim {
  /** Seconds since the round started; negative during the countdown. */
  t = -BUMPER_COUNTDOWN_SECONDS;
  phase: BumperPhase = "countdown";
  rings: Ring[];
  /** The edge right now. */
  radius: number;
  readonly startRadius: number;
  /** The edge is about to drop. */
  warning = false;
  winner: string | null = null;
  /** Filled by step(); whoever draws the game drains it. */
  events: BumperEvent[] = [];

  constructor(
    readonly map: BumperMap,
    entrants: BumperEntrant[],
    readonly tuning: BumperTuning = BUMPER_TUNING,
  ) {
    this.startRadius = this.radius = arenaRadius(map, entrants.length);
    const n = entrants.length;
    // Evenly round the arena, the first entrant nearest the camera (+z), all facing the middle.
    const spawn = this.startRadius * 0.5;
    this.rings = entrants.map((e, i) => {
      const a = (i / n) * Math.PI * 2;
      return {
        ...e,
        x: Math.sin(a) * spawn,
        z: Math.cos(a) * spawn,
        y: 0,
        vx: 0,
        vz: 0,
        vy: 0,
        facing: a + Math.PI,
        wobble: 0,
        dashLeft: 0,
        dashCooldown: 0,
        bracing: false,
        braceHeld: 0,
        braceCooldown: 0,
        state: "in",
        fellAt: null,
        lastHitBy: null,
        lastHitAt: -Infinity,
        touchedAt: -Infinity,
        kos: 0,
        input: { ...NO_INPUT },
      };
    });
  }

  ring(id: string): Ring | undefined {
    return this.rings.find((r) => r.id === id);
  }

  alive(): Ring[] {
    return this.rings.filter((r) => r.state === "in");
  }

  /** The edge at round time `t`: whole until sudden death, then dropping a step at a time. */
  edgeAt(t: number): number {
    const sd = this.map.suddenDeath;
    if (t < sd.at) return this.startRadius;
    const drops = Math.floor((t - sd.at) / sd.every) + 1;
    return Math.max(sd.minRadius, this.startRadius - drops * sd.step);
  }

  step(dt: number) {
    this.t += dt;
    if (this.phase === "countdown") {
      if (this.t < 0) return;
      this.phase = "play";
      this.events.push({ type: "start" });
    }
    this.updateEdge();
    for (const r of this.rings) this.drive(r, dt);
    this.collide();
    for (const r of this.rings) this.edge(r, dt);
    this.checkOver();
  }

  private updateEdge() {
    if (this.phase !== "play") return;
    const next = this.edgeAt(this.t);
    if (next < this.radius) {
      this.radius = next;
      this.events.push({ type: "drop", radius: next });
    }
    const warning = this.edgeAt(this.t + this.map.suddenDeath.warnSeconds) < this.radius;
    if (warning && !this.warning) this.events.push({ type: "warn" });
    this.warning = warning;
  }

  private drive(r: Ring, dt: number) {
    const k = this.tuning;
    if (r.state !== "in") return;
    const input = this.phase === "play" ? r.input : NO_INPUT;
    r.dashCooldown = Math.max(0, r.dashCooldown - dt);
    r.braceCooldown = Math.max(0, r.braceCooldown - dt);
    r.dashLeft = Math.max(0, r.dashLeft - dt);

    // Brace: heavier and slow, for a while, then a cooldown that grows with how long it was held.
    if (input.brace && r.dashLeft === 0 && r.braceCooldown === 0) {
      r.bracing = true;
      r.braceHeld += dt;
      if (r.braceHeld >= k.braceMaxSeconds) this.endBrace(r);
    } else if (r.bracing) {
      this.endBrace(r);
    }

    let ix = input.x;
    let iz = input.z;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }

    if (input.dash && r.dashCooldown === 0 && !r.bracing) {
      // Toward the stick, or straight ahead with the stick let go.
      const [dx, dz] = len > 0.2 ? [ix / Math.min(1, len), iz / Math.min(1, len)] : [Math.sin(r.facing), Math.cos(r.facing)];
      r.vx = dx * k.dashSpeed;
      r.vz = dz * k.dashSpeed;
      r.dashLeft = k.dashSeconds;
      r.dashCooldown = k.dashCooldown;
      this.events.push({ type: "dash", id: r.id });
    }

    const was = Math.hypot(r.vx, r.vz);
    if (r.dashLeft === 0) {
      r.vx += ix * k.accel * dt;
      r.vz += iz * k.accel * dt;
    }
    const drag = Math.exp(-(k.drag + (len < 0.1 ? k.brakeDrag : 0)) * dt);
    r.vx *= drag;
    r.vz *= drag;
    // Over top speed (knocked, or a dash ending): slide back down to it, don't snap. Driving
    // can steer the slide but not stretch it.
    const top = k.maxSpeed * (r.bracing ? k.braceSpeed : 1);
    const speed = Math.hypot(r.vx, r.vz);
    if (r.dashLeft === 0 && speed > top) {
      const s = Math.max(top, Math.min(speed, was) - k.overspeedDecel * dt) / speed;
      r.vx *= s;
      r.vz *= s;
    }

    r.x += r.vx * dt;
    r.z += r.vz * dt;
    if (speed > 0.4) r.facing = Math.atan2(r.vx, r.vz);

    if (this.t - r.touchedAt > k.wobbleRestSeconds) r.wobble = Math.max(0, r.wobble - k.wobbleDrain * dt);
  }

  private endBrace(r: Ring) {
    const k = this.tuning;
    r.braceCooldown = Math.max(0.5, (k.braceCooldown * r.braceHeld) / k.braceMaxSeconds);
    r.bracing = false;
    r.braceHeld = 0;
  }

  private collide() {
    const k = this.tuning;
    const rings = this.rings.filter((r) => r.state === "in");
    const reach = k.radius * 2;
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const a = rings[i];
        const b = rings[j];
        let nx = b.x - a.x;
        let nz = b.z - a.z;
        const d = Math.hypot(nx, nz);
        if (d >= reach) continue;
        if (d < 1e-6) {
          nx = 1;
          nz = 0;
        } else {
          nx /= d;
          nz /= d;
        }
        const ma = ringMass(a, k);
        const mb = ringMass(b, k);
        // Push apart, the lighter ring moving more.
        const overlap = reach - d;
        a.x -= nx * overlap * (mb / (ma + mb));
        a.z -= nz * overlap * (mb / (ma + mb));
        b.x += nx * overlap * (ma / (ma + mb));
        b.z += nz * overlap * (ma / (ma + mb));

        // How fast each was driving into the other.
        const sa = Math.max(0, a.vx * nx + a.vz * nz);
        const sb = Math.max(0, -(b.vx * nx + b.vz * nz));
        const closing = a.vx * nx + a.vz * nz - (b.vx * nx + b.vz * nz);
        if (closing <= 0) continue;

        const impulse = ((1 + k.restitution) * closing) / (1 / ma + 1 / mb);
        a.vx -= (nx * impulse) / ma;
        a.vz -= (nz * impulse) / ma;
        b.vx += (nx * impulse) / mb;
        b.vz += (nz * impulse) / mb;

        // The extra shove, scaled up by the wobble of whoever takes it.
        this.shove(a, b, sa, nx, nz, mb);
        this.shove(b, a, sb, -nx, -nz, ma);
        a.touchedAt = b.touchedAt = this.t;

        const dash = a.dashLeft > 0 || b.dashLeft > 0;
        this.events.push({ type: "hit", a: a.id, b: b.id, x: a.x + nx * k.radius, z: a.z + nz * k.radius, power: closing / k.maxSpeed, dash });
      }
    }
  }

  /** `from` drove into `to` at `speed` along (nx, nz). */
  private shove(from: Ring, to: Ring, speed: number, nx: number, nz: number, mass: number) {
    const k = this.tuning;
    if (speed <= 0.5) return;
    const dashing = from.dashLeft > 0;
    const push = (k.knockBase * Math.min(2, speed / k.maxSpeed) * (dashing ? k.dashKnock : 1) * (k.knockFloor + to.wobble / 100)) / mass;
    to.vx += nx * push;
    to.vz += nz * push;
    const wobble = dashing ? k.wobbleDash : k.wobbleBump * Math.min(1, speed / k.maxSpeed);
    to.wobble = Math.min(k.wobbleMax, to.wobble + wobble / mass);
    if (speed > 1.2) {
      to.lastHitBy = from.id;
      to.lastHitAt = this.t;
    }
  }

  private edge(r: Ring, dt: number) {
    const k = this.tuning;
    if (r.state === "in") {
      // Off once its centre is past the edge: half the ring hanging over.
      if (Math.hypot(r.x, r.z) <= this.radius) return;
      r.state = "falling";
      r.bracing = false;
      r.fellAt = this.t;
      this.events.push({ type: "fall", id: r.id });
      return;
    }
    r.vy -= k.gravity * dt;
    r.y += r.vy * dt;
    r.x += r.vx * dt;
    r.z += r.vz * dt;
    if (r.state === "falling" && r.y < -2.5) {
      r.state = "out";
      const by = r.lastHitBy && r.fellAt !== null && r.fellAt - r.lastHitAt <= k.koWindow ? r.lastHitBy : null;
      const hitter = by ? this.ring(by) : undefined;
      if (hitter) hitter.kos++;
      this.events.push({ type: "out", id: r.id, by });
    }
  }

  private checkOver() {
    if (this.phase !== "play" || this.rings.length < 2) return;
    const alive = this.alive();
    if (alive.length > 1) return;
    this.phase = "over";
    if (alive.length === 1) {
      this.winner = alive[0].id;
    } else {
      // Nobody left: the last one to go over the edge wins, unless they went together.
      const last = Math.max(...this.rings.map((r) => r.fellAt ?? -Infinity));
      const lasts = this.rings.filter((r) => r.fellAt === last);
      this.winner = lasts.length === 1 ? lasts[0].id : null;
    }
    this.events.push({ type: "over", winner: this.winner });
  }
}
