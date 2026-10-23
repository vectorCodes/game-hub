// Bumper Arena's physics: rings are circles sliding on the arena floor (x, z), plus a simple
// fall once they leave it. No physics engine: circle-vs-circle hits, a shrinking edge, the
// maps' hazards (a sweeping bar, dropping tiles), pickups and timers. Pure and framework-free, so the same code runs the solo game in the browser
// and the party rooms on the server. Units are metres and seconds; +y is up.
import { arenaRadius, BUMPER_COUNTDOWN_SECONDS, BUMPER_TUNING, HEX, hexAt, hexTiles, outlineAt, PICKUP_KINDS, PICKUPS, SPINNER, spinnerSpeed, withGrip, type BumperMap, type BumperTuning, type PickupKind } from "./bumper";
import { makeRng } from "./skyClimb";

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
  /** Seconds its centre has been over a hole (Hex Hive). */
  overHole: number;
  /** The pickup it's using, and seconds left of it. */
  effect: PickupKind | null;
  effectLeft: number;
  /** Seconds left sliding on a banana patch. */
  slip: number;
  input: BumperInput;
}

/** A pickup on the arena: it can be taken once round time passes `at` + PICKUPS.warn. */
export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  z: number;
  at: number;
}

/** A banana patch: slick until round time `until`. */
export interface BananaPatch {
  id: number;
  x: number;
  z: number;
  owner: string;
  at: number;
  until: number;
}

export interface BumperSimOptions {
  /** Pickups appear (off by default). */
  pickups?: boolean;
  /** Seeds where and which pickups appear. */
  seed?: string;
}

export type BumperEvent =
  | { type: "start" }
  | { type: "dash"; id: string }
  | { type: "hit"; a: string; b: string; x: number; z: number; /** Closing speed over top speed. */ power: number; dash: boolean }
  | { type: "fall"; id: string }
  | { type: "out"; id: string; by: string | null }
  | { type: "warn" }
  | { type: "drop"; radius: number }
  /** Hex Hive: a tile started to crack, or dropped. */
  | { type: "crack"; x: number; z: number }
  | { type: "tileDrop"; x: number; z: number }
  /** A pickup appeared (pulsing), or a ring took one. */
  | { type: "spawn"; kind: PickupKind; x: number; z: number }
  | { type: "pickup"; id: string; kind: PickupKind; x: number; z: number }
  /** A Shockwave dash went off; a Bubble took a hit; a ring hit a banana patch. */
  | { type: "shock"; id: string; x: number; z: number }
  | { type: "pop"; id: string }
  | { type: "slip"; id: string }
  | { type: "over"; winner: string | null };

export type BumperPhase = "countdown" | "play" | "over";

export interface HexTile {
  x: number;
  z: number;
  /** up: solid · cracking: driven over, about to drop · down: gone. */
  state: "up" | "cracking" | "down";
  /** When it started cracking. */
  at: number;
  /** Ring-seconds spent on it so far. */
  wear: number;
}

export interface BumperEntrant {
  id: string;
  name: string;
  bot: boolean;
}

const NO_INPUT: BumperInput = { x: 0, z: 0, dash: false, brace: false };

export const ringMass = (r: Ring, tuning: BumperTuning) => (r.bracing ? tuning.braceMass : 1) * (r.effect === "heavy" ? PICKUPS.heavy.mass : 1);
export const ringRadius = (r: Ring, tuning: BumperTuning) => tuning.radius * (r.effect === "heavy" ? PICKUPS.heavy.scale : 1);

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
  /** The ring tuning on this map (slippery maps grip less). */
  readonly tuning: BumperTuning;
  /** Spinner: the bar's heading (radians) and angular speed. */
  spinner = { angle: 0, speed: 0 };
  /** Hex Hive: the floor. */
  tiles: HexTile[] = [];
  pickups: Pickup[] = [];
  patches: BananaPatch[] = [];
  private tileIndex = new Map<string, number>();
  private readonly pickupsOn: boolean;
  private readonly rng: () => number;
  private nextPickupAt: number = PICKUPS.first;
  private nextId = 1;
  /** Rings that dashed this step (a Shockwave goes off after everyone has driven). */
  private dashed: Ring[] = [];

  constructor(
    readonly map: BumperMap,
    entrants: BumperEntrant[],
    tuning: BumperTuning = BUMPER_TUNING,
    options: BumperSimOptions = {},
  ) {
    this.tuning = withGrip(tuning, map.grip);
    this.pickupsOn = options.pickups ?? false;
    this.rng = makeRng(options.seed ?? `pickups:${map.id}`);
    this.startRadius = this.radius = arenaRadius(map, entrants.length);
    if (map.kind === "hex") {
      for (const tile of hexTiles(this.startRadius)) {
        this.tileIndex.set(`${tile.q},${tile.r}`, this.tiles.length);
        this.tiles.push({ x: tile.x, z: tile.z, state: "up", at: 0, wear: 0 });
      }
    }
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
        overHole: 0,
        effect: null,
        effectLeft: 0,
        slip: 0,
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

  /** Index of the hex tile under (x, z), or -1 off the floor. */
  tileAt(x: number, z: number): number {
    const { q, r } = hexAt(x, z);
    return this.tileIndex.get(`${q},${r}`) ?? -1;
  }

  /** How far the edge is from the middle in the direction of (x, z). */
  edgeRadius(x: number, z: number): number {
    return this.radius * outlineAt(this.map, Math.atan2(x, z));
  }

  /** Whether (x, z) is floor: inside the edge, or on a tile that hasn't dropped (`firm`: nor started to crack). */
  onFloor(x: number, z: number, firm = false): boolean {
    if (this.map.kind !== "hex") return Math.hypot(x, z) <= this.edgeRadius(x, z);
    const i = this.tileAt(x, z);
    return i >= 0 && (firm ? this.tiles[i].state === "up" : this.tiles[i].state !== "down");
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
    this.shockwaves();
    this.sweep(dt);
    this.crumble(dt);
    this.collide();
    this.pickupStep();
    for (const r of this.rings) this.edge(r, dt);
    this.checkOver();
  }

  /** Time's up with rings still on (a room's limit on a round): they share it. */
  timeUp() {
    if (this.phase !== "play") return;
    this.phase = "over";
    const alive = this.alive();
    this.winner = alive.length === 1 ? alive[0].id : null;
    this.events.push({ type: "over", winner: this.winner });
  }

  /** One ring's driving for a step and nothing else (no hits, no edge): a client predicting its own ring between snapshots. */
  driveOnly(r: Ring, dt: number) {
    this.drive(r, dt);
    this.dashed.length = 0;
  }

  private updateEdge() {
    if (this.phase !== "play") return;
    const next = this.edgeAt(this.t);
    if (next < this.radius) {
      this.radius = next;
      this.events.push({ type: "drop", radius: next });
      // Hex Hive: the tiles outside the new edge start to crack.
      for (const tile of this.tiles) {
        if (tile.state === "up" && Math.hypot(tile.x, tile.z) > next) {
          tile.state = "cracking";
          tile.at = this.t;
        }
      }
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
    r.slip = Math.max(0, r.slip - dt);
    if (r.effect) {
      r.effectLeft -= dt;
      if (r.effectLeft <= 0) r.effect = null;
    }
    // On a banana patch: hardly any grip.
    const grip = r.slip > 0 ? PICKUPS.banana.grip : 1;

    // Brace: heavier and slow, for a while, then a cooldown that grows with how long it was held.
    if (input.brace && k.braceMaxSeconds > 0 && r.dashLeft === 0 && r.braceCooldown === 0) {
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
      r.dashCooldown = r.effect === "turbo" ? PICKUPS.turbo.cooldown : k.dashCooldown;
      this.dashed.push(r);
      this.events.push({ type: "dash", id: r.id });
    }

    const was = Math.hypot(r.vx, r.vz);
    if (r.dashLeft === 0) {
      r.vx += ix * k.accel * grip * dt;
      r.vz += iz * k.accel * grip * dt;
    }
    const drag = Math.exp(-(k.drag + (len < 0.1 ? k.brakeDrag : 0)) * grip * dt);
    r.vx *= drag;
    r.vz *= drag;
    // Over top speed (knocked, or a dash ending): slide back down to it, don't snap. Driving
    // can steer the slide but not stretch it.
    const top = k.maxSpeed * (r.bracing ? k.braceSpeed : 1) * (r.effect === "heavy" ? PICKUPS.heavy.speed : 1);
    const speed = Math.hypot(r.vx, r.vz);
    if (r.dashLeft === 0 && speed > top) {
      const s = Math.max(top, Math.min(speed, was) - k.overspeedDecel * grip * dt) / speed;
      r.vx *= s;
      r.vz *= s;
    }

    r.x += r.vx * dt;
    r.z += r.vz * dt;
    if (speed > 0.4) r.facing = Math.atan2(r.vx, r.vz);

    if (this.t - r.touchedAt > k.wobbleRestSeconds) r.wobble = Math.max(0, r.wobble - k.wobbleDrain * dt);
  }

  /** Spinner: the bar sweeps round the post, carrying along any ring in its way. */
  private sweep(dt: number) {
    if (this.map.kind !== "spinner" || this.phase === "countdown") return;
    const k = this.tuning;
    const w = (this.spinner.speed = spinnerSpeed(this.t));
    const angle = (this.spinner.angle += w * dt);
    // Along the bar (d) and across it, the way it moves (t).
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const tx = Math.cos(angle);
    const tz = -Math.sin(angle);
    for (const r of this.rings) {
      if (r.state !== "in") continue;
      const radius = ringRadius(r, k);
      const reach = radius + SPINNER.halfWidth;
      const hubReach = SPINNER.hubRadius + radius;
      // The post: solid, a firm bounce.
      const d = Math.hypot(r.x, r.z);
      if (d < hubReach && d > 1e-6) {
        const nx = r.x / d;
        const nz = r.z / d;
        r.x = nx * hubReach;
        r.z = nz * hubReach;
        const vn = r.vx * nx + r.vz * nz;
        if (vn < 0) {
          r.vx -= 1.5 * vn * nx;
          r.vz -= 1.5 * vn * nz;
        }
      }
      const along = r.x * dx + r.z * dz;
      if (Math.abs(along) < SPINNER.hubRadius || Math.abs(along) > this.radius + 1) continue;
      const across = r.x * tx + r.z * tz;
      if (Math.abs(across) >= reach) continue;
      const barSpeed = w * along;
      const side = Math.sign(across) || Math.sign(barSpeed);
      r.x += tx * (side * reach - across);
      r.z += tz * (side * reach - across);
      const vt = r.vx * tx + r.vz * tz;
      if (barSpeed * side > 0) {
        // In front of the bar: carried along, a little faster than the bar itself.
        const want = barSpeed * SPINNER.push;
        if (Math.abs(vt) < Math.abs(want) || Math.sign(vt) !== Math.sign(want)) {
          r.vx += tx * (want - vt);
          r.vz += tz * (want - vt);
        }
        if (this.t - r.touchedAt > 0.5) {
          if (r.effect === "bubble") this.pop(r);
          else r.wobble = Math.min(k.wobbleMax, r.wobble + SPINNER.wobble);
          this.events.push({ type: "hit", a: "spinner", b: r.id, x: r.x - tx * side * radius, z: r.z - tz * side * radius, power: Math.abs(want) / k.maxSpeed, dash: false });
        }
        r.touchedAt = this.t;
      } else if (vt * side < 0) {
        // Drove into the back of it: bounce off.
        r.vx -= tx * vt * 1.5;
        r.vz -= tz * vt * 1.5;
      }
    }
  }

  /** Hex Hive: a tile wears under the rings on it; after `HEX.wearSeconds` of ring-time it cracks, and drops a moment later. */
  private crumble(dt: number) {
    if (this.map.kind !== "hex" || this.phase === "countdown") return;
    for (const r of this.rings) {
      if (r.state !== "in") continue;
      const tile = this.tiles[this.tileAt(r.x, r.z)];
      if (!tile || tile.state !== "up") continue;
      tile.wear += dt;
      if (tile.wear >= HEX.wearSeconds) {
        tile.state = "cracking";
        tile.at = this.t;
        this.events.push({ type: "crack", x: tile.x, z: tile.z });
      }
    }
    for (const tile of this.tiles) {
      if (tile.state === "cracking" && this.t - tile.at >= HEX.crackSeconds) {
        tile.state = "down";
        this.events.push({ type: "tileDrop", x: tile.x, z: tile.z });
      }
    }
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
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const a = rings[i];
        const b = rings[j];
        const ra = ringRadius(a, k);
        const reach = ra + ringRadius(b, k);
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
        this.events.push({ type: "hit", a: a.id, b: b.id, x: a.x + nx * ra, z: a.z + nz * ra, power: closing / k.maxSpeed, dash });
      }
    }
  }

  /** `from` drove into `to` at `speed` along (nx, nz). */
  private shove(from: Ring, to: Ring, speed: number, nx: number, nz: number, mass: number) {
    const k = this.tuning;
    if (speed <= 0.5) return;
    // A Bubble takes the hit instead: no shove, no wobble.
    if (to.effect === "bubble") return this.pop(to);
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

  private pop(r: Ring) {
    r.effect = null;
    r.effectLeft = 0;
    this.events.push({ type: "pop", id: r.id });
  }

  /** Shockwave: a ring holding one that dashed this step blasts everyone close outward. */
  private shockwaves() {
    const k = this.tuning;
    const { radius, push, wobble } = PICKUPS.shock;
    for (const r of this.dashed) {
      if (r.effect !== "shock") continue;
      r.effect = null;
      r.effectLeft = 0;
      this.events.push({ type: "shock", id: r.id, x: r.x, z: r.z });
      for (const o of this.rings) {
        if (o === r || o.state !== "in") continue;
        const dx = o.x - r.x;
        const dz = o.z - r.z;
        const d = Math.hypot(dx, dz);
        if (d > radius + ringRadius(o, k) || d < 1e-6) continue;
        if (o.effect === "bubble") {
          this.pop(o);
          continue;
        }
        const f = (push * (1 - (0.5 * d) / radius) * (k.knockFloor + o.wobble / 100 + 0.5)) / ringMass(o, k);
        o.vx += (dx / d) * f;
        o.vz += (dz / d) * f;
        o.wobble = Math.min(k.wobbleMax, o.wobble + wobble / ringMass(o, k));
        o.lastHitBy = r.id;
        o.lastHitAt = o.touchedAt = this.t;
      }
    }
    this.dashed.length = 0;
  }

  /** Pickups: a new one now and then, rings taking them, and banana patches catching rings. */
  private pickupStep() {
    if (!this.pickupsOn || this.phase !== "play") return;
    const k = this.tuning;
    if (this.t >= this.nextPickupAt) {
      this.nextPickupAt += PICKUPS.every;
      if (this.pickups.length < PICKUPS.max) this.spawnPickup();
    }
    for (const p of [...this.pickups]) {
      if (this.t < p.at + PICKUPS.warn) continue;
      const r = this.alive().find((r) => Math.hypot(r.x - p.x, r.z - p.z) < ringRadius(r, k) + PICKUPS.reach);
      if (r) this.take(r, p);
    }
    const { radius, slip, ownerSafe } = PICKUPS.banana;
    this.patches = this.patches.filter((b) => b.until > this.t);
    for (const r of this.alive()) {
      if (r.slip > 0) continue;
      const on = this.patches.some((b) => (b.owner !== r.id || this.t - b.at > ownerSafe) && Math.hypot(r.x - b.x, r.z - b.z) < radius);
      if (!on) continue;
      r.slip = slip;
      this.events.push({ type: "slip", id: r.id });
    }
  }

  /** A pickup somewhere safe: on solid floor, away from the edge, the rings and the Spinner's post. */
  private spawnPickup() {
    const kind = PICKUP_KINDS[Math.floor(this.rng() * PICKUP_KINDS.length)];
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * this.radius * 0.7;
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      if (!this.onFloor(x, z, true) || d > this.edgeRadius(x, z) - 1.5) continue;
      if (this.map.kind === "spinner" && d < SPINNER.hubRadius + 1) continue;
      if (this.alive().some((r) => Math.hypot(r.x - x, r.z - z) < 2)) continue;
      if (this.pickups.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      this.pickups.push({ id: this.nextId++, kind, x, z, at: this.t });
      this.events.push({ type: "spawn", kind, x, z });
      return;
    }
  }

  private take(r: Ring, p: Pickup) {
    this.pickups = this.pickups.filter((q) => q !== p);
    this.events.push({ type: "pickup", id: r.id, kind: p.kind, x: p.x, z: p.z });
    if (p.kind === "banana") {
      const { behind, patchSeconds } = PICKUPS.banana;
      this.patches.push({ id: this.nextId++, x: r.x - Math.sin(r.facing) * behind, z: r.z - Math.cos(r.facing) * behind, owner: r.id, at: this.t, until: this.t + patchSeconds });
      return;
    }
    r.effect = p.kind;
    r.effectLeft = PICKUPS[p.kind].seconds;
  }

  private edge(r: Ring, dt: number) {
    const k = this.tuning;
    if (r.state === "in") {
      // Off once its centre is past the edge (half the ring hanging over), or over a hole for
      // longer than a quick ring takes to skim across one.
      if (this.onFloor(r.x, r.z)) {
        r.overHole = 0;
        return;
      }
      const inside = this.map.kind === "hex" && Math.hypot(r.x, r.z) < this.radius;
      r.overHole += dt;
      if (inside && r.overHole < HEX.skimSeconds) return;
      r.state = "falling";
      r.bracing = false;
      r.effect = null;
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
