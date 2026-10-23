// Bumper Arena bots. A bot only looks at the world every so often (its reaction time), then
// keeps doing what it decided: get back from the edge, grab a pickup that's close, pick someone
// near the edge, get on the middle side of them, and dash when lined up. Easy bots look less
// often, aim worse and rarely brace.
import { makeRng } from "./skyClimb";
import { SPINNER } from "./bumper";
import type { BumperInput, BumperSim, Ring } from "./bumperSim";

export type BotLevel = "easy" | "normal" | "hard";

interface BotSkill {
  /** Seconds between looks at the world. */
  reaction: number;
  /** Radians of aim error, either way. */
  aimNoise: number;
  /** Dashes at a lined-up target this close (m)… */
  dashRange: number;
  /** …this often. */
  dashChance: number;
  /** How far past its target (m) a dash may carry it before it calls the dash too risky. */
  overrun: number;
  /** How likely it braces when something is coming at it near the edge. */
  brace: number;
  /** Heads back to the middle once it's this close to the edge (m). */
  edgeCare: number;
  /** How likely it notices, between looks, that it's sliding off. */
  reflex: number;
  /** How likely a look ends in aimless drifting instead. */
  wander: number;
  /** How likely it goes for a pickup that's close and nearer to it than to anyone else. */
  pickup: number;
}

export const BOT_SKILLS: Record<BotLevel, BotSkill> = {
  easy: { reaction: 0.6, aimNoise: 0.5, dashRange: 3, dashChance: 0.45, overrun: 0.5, brace: 0.15, edgeCare: 0.9, reflex: 0.7, wander: 0.3, pickup: 0.25 },
  normal: { reaction: 0.3, aimNoise: 0.25, dashRange: 3.5, dashChance: 0.75, overrun: 1.5, brace: 0.5, edgeCare: 1.4, reflex: 0.9, wander: 0.08, pickup: 0.6 },
  hard: { reaction: 0.15, aimNoise: 0.1, dashRange: 4, dashChance: 0.95, overrun: 2.5, brace: 0.9, edgeCare: 1.9, reflex: 1, wander: 0, pickup: 0.9 },
};

export const BOT_NAMES = ["Bumpy", "Wobbles", "Sir Shove", "Donut Dan", "Boinks", "Rubber Ru", "Tubby", "Spinny", "Nudge", "Big Bop"];

export class BotBrain {
  private next = 0;
  private target: string | null = null;
  private retargetAt = 0;
  private reflex = true;
  private intent: BumperInput = { x: 0, z: 0, dash: false, brace: false };
  private readonly rng: () => number;
  readonly skill: BotSkill;

  constructor(
    readonly id: string,
    level: BotLevel,
    seed: string,
  ) {
    this.skill = BOT_SKILLS[level];
    this.rng = makeRng(`${seed}:${id}`);
    // Not every bot looks at the same moment.
    this.next = this.rng() * this.skill.reaction;
  }

  /** This step's input for the bot's ring. */
  think(sim: BumperSim): BumperInput {
    const me = sim.ring(this.id);
    if (!me || me.state !== "in" || sim.phase !== "play") return { x: 0, z: 0, dash: false, brace: false };
    if (sim.t >= this.next) {
      this.next = sim.t + this.skill.reaction * (0.7 + this.rng() * 0.6);
      this.intent = this.decide(sim, me);
      this.reflex = this.rng() < this.skill.reflex;
    }
    // Reflexes, between looks (if it notices): about to slide off or into a hole, so steer
    // for solid floor; the Spinner's bar coming, so get out of its way.
    // Standing on a cracking tile is plain to see: everyone steps off.
    if (!sim.onFloor(me.x, me.z, true)) {
      const [x, z] = safeHeading(sim, me);
      return { x, z, dash: false, brace: false };
    }
    if (this.reflex) {
      const ax = me.x + me.vx * 0.5;
      const az = me.z + me.vz * 0.5;
      if (!sim.onFloor(ax, az, true) || Math.hypot(ax, az) > sim.edgeRadius(ax, az) - 0.3) {
        const [x, z] = safeHeading(sim, me);
        return { x, z, dash: false, brace: false };
      }
      const dodge = dodgeBar(sim, me);
      if (dodge) return { x: dodge[0], z: dodge[1], dash: false, brace: false };
    }
    const input = { ...this.intent };
    // A dash is a press, not a hold.
    this.intent.dash = false;
    return input;
  }

  private decide(sim: BumperSim, me: Ring): BumperInput {
    const s = this.skill;
    const rng = this.rng;
    // Where it's heading, not just where it is.
    const hx = me.x + me.vx * 0.35;
    const hz = me.z + me.vz * 0.35;
    const fromMiddle = Math.hypot(hx, hz);
    const margin = sim.edgeRadius(hx, hz) - fromMiddle;
    const others = sim.alive().filter((r) => r.id !== me.id);

    // Is someone coming at me?
    const threatened = others.some((o) => {
      const dx = me.x - o.x;
      const dz = me.z - o.z;
      const d = Math.hypot(dx, dz);
      return d < 3 && ((o.vx - me.vx) * dx + (o.vz - me.vz) * dz) / d > 3;
    });
    const brace = threatened && margin < 2.5 && rng() < s.brace;

    if (margin < s.edgeCare && fromMiddle > 0.01) return this.aim(-me.x / fromMiddle, -me.z / fromMiddle, false, brace);
    if (brace) return { x: 0, z: 0, dash: false, brace: true };
    if (!others.length) return { x: 0, z: 0, dash: false, brace: false };
    // A pickup close by that nobody else is nearer to.
    const pickup = sim.pickups.find((p) => {
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      return d < 6 && others.every((o) => Math.hypot(p.x - o.x, p.z - o.z) > d);
    });
    if (pickup && rng() < s.pickup) {
      const px = pickup.x - me.x;
      const pz = pickup.z - me.z;
      const pd = Math.hypot(px, pz) || 1;
      return this.aim(px / pd, pz / pd, false, false, 0.4);
    }
    if (rng() < s.wander) {
      const a = rng() * Math.PI * 2;
      return { x: Math.sin(a) * 0.5, z: Math.cos(a) * 0.5, dash: false, brace: false };
    }

    // Someone close and close to the edge.
    let target = this.target ? others.find((o) => o.id === this.target) : undefined;
    if (!target || sim.t >= this.retargetAt) {
      let best = Infinity;
      for (const o of others) {
        const score = Math.hypot(o.x - me.x, o.z - me.z) - 0.7 * Math.hypot(o.x, o.z) + rng() * 2;
        if (score < best) {
          best = score;
          target = o;
        }
      }
      this.target = target?.id ?? null;
      this.retargetAt = sim.t + 2 + rng() * 2;
    }
    if (!target) return { x: 0, z: 0, dash: false, brace: false };

    // Push them outward: come at them from the middle's side.
    const tFrom = Math.hypot(target.x, target.z);
    const [ux, uz] = tFrom > 0.3 ? [target.x / tFrom, target.z / tFrom] : [target.x - me.x, target.z - me.z];
    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const d = Math.hypot(dx, dz) || 1;
    const lined = (dx * ux + dz * uz) / (d * (Math.hypot(ux, uz) || 1));

    if (d < s.dashRange && lined > 0.5 && me.dashCooldown === 0 && rng() < s.dashChance) {
      // Lead the target a little, and only if a miss wouldn't carry it off the edge.
      const px = target.x + target.vx * 0.15 - me.x;
      const pz = target.z + target.vz * 0.15 - me.z;
      const pd = Math.hypot(px, pz) || 1;
      const overrun = pd + s.overrun;
      const ex = me.x + (px / pd) * overrun;
      const ez = me.z + (pz / pd) * overrun;
      const safe = Math.hypot(ex, ez) < sim.edgeRadius(ex, ez) && sim.onFloor(ex, ez, true);
      if (safe) return this.aim(px / pd, pz / pd, true, false, 0.5);
    }
    if (lined > 0.3) return this.aim(dx / d, dz / d, false, false);
    // Circle round to the middle side of them.
    const gx = target.x - ux * 1.4 - me.x;
    const gz = target.z - uz * 1.4 - me.z;
    const gd = Math.hypot(gx, gz) || 1;
    return this.aim(gx / gd, gz / gd, false, false);
  }

  /** Drive along (x, z), give or take the bot's aim error. */
  private aim(x: number, z: number, dash: boolean, brace: boolean, steady = 1): BumperInput {
    const err = (this.rng() - 0.5) * 2 * this.skill.aimNoise * steady;
    const c = Math.cos(err);
    const s = Math.sin(err);
    return { x: x * c - z * s, z: x * s + z * c, dash, brace };
  }
}

/** The way to solid floor: of twelve headings, the one with floor under it 1.5 m and 3 m out, nearest the middle. */
function safeHeading(sim: BumperSim, me: Ring): [number, number] {
  let best: [number, number] = [0, 0];
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    if (!sim.onFloor(me.x + x * 1.5, me.z + z * 1.5, true)) continue;
    const far = sim.onFloor(me.x + x * 3, me.z + z * 3, true);
    const score = (far ? 10 : 0) - Math.hypot(me.x + x * 3, me.z + z * 3);
    if (score > bestScore) {
      bestScore = score;
      best = [x, z];
    }
  }
  if (bestScore === -Infinity) {
    const d = Math.hypot(me.x, me.z) || 1;
    return [-me.x / d, -me.z / d];
  }
  return best;
}

/** Spinner: with the bar sweeping towards it, the way out of its path (along with it, and inwards, where it's slower). */
function dodgeBar(sim: BumperSim, me: Ring): [number, number] | null {
  if (sim.map.kind !== "spinner") return null;
  const { angle, speed } = sim.spinner;
  const along = me.x * Math.sin(angle) + me.z * Math.cos(angle);
  const tx = Math.cos(angle);
  const tz = -Math.sin(angle);
  const across = me.x * tx + me.z * tz;
  if (Math.abs(along) < SPINNER.hubRadius || Math.abs(across) > 3) return null;
  const side = Math.sign(across) || 1;
  // Only if the bar is moving into this side.
  if (speed * along * side <= 0) return null;
  const inward = Math.abs(along) > 4 ? 0.5 : 0;
  const x = tx * side - Math.sin(angle) * Math.sign(along) * inward;
  const z = tz * side - Math.cos(angle) * Math.sign(along) * inward;
  const len = Math.hypot(x, z) || 1;
  return [x / len, z / len];
}
