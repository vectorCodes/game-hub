// Bumper Arena bots. A bot only looks at the world every so often (its reaction time), then
// keeps doing what it decided: get back from the edge, pick someone near the edge, get on
// the middle side of them, and dash when lined up. Easy bots look less often, aim worse and
// rarely brace.
import { makeRng } from "./skyClimb";
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
}

export const BOT_SKILLS: Record<BotLevel, BotSkill> = {
  easy: { reaction: 0.6, aimNoise: 0.5, dashRange: 3, dashChance: 0.45, overrun: 0.5, brace: 0.15, edgeCare: 0.9, reflex: 0.7, wander: 0.3 },
  normal: { reaction: 0.3, aimNoise: 0.25, dashRange: 3.5, dashChance: 0.75, overrun: 1.5, brace: 0.5, edgeCare: 1.4, reflex: 0.9, wander: 0.08 },
  hard: { reaction: 0.15, aimNoise: 0.1, dashRange: 4, dashChance: 0.95, overrun: 2.5, brace: 0.9, edgeCare: 1.9, reflex: 1, wander: 0 },
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
    // A reflex, between looks: about to slide off, so steer back (if it notices).
    const ahead = Math.hypot(me.x + me.vx * 0.5, me.z + me.vz * 0.5);
    if (this.reflex && ahead > sim.radius - 0.3) {
      const d = Math.hypot(me.x, me.z) || 1;
      return { x: -me.x / d, z: -me.z / d, dash: false, brace: false };
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
    const fromMiddle = Math.hypot(me.x + me.vx * 0.35, me.z + me.vz * 0.35);
    const margin = sim.radius - fromMiddle;
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
      const safe = Math.hypot(me.x + (px / pd) * overrun, me.z + (pz / pd) * overrun) < sim.radius;
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
