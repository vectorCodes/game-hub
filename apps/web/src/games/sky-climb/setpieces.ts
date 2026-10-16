// The hand-built zone finales. Each step is one floor's platform, laid out by the tower
// generator like any other, but with its size, kind, spacing and extras fixed here instead
// of rolled. Tuning a set-piece only means editing its steps.
import type { SetPieceId } from "./config";

export type Size = "big" | "long" | "normal" | "narrow";

export interface StepSpec {
  size: Size;
  /** Overrides the zone's piece for this size. */
  piece?: string;
  kind: "static" | "crumble" | "vanish" | "orbit";
  rise: number;
  /** Horizontal gap from the previous platform, edge to edge. */
  gap: number;
  /** Never icy, whatever the zone or twist: landing here is hard enough. */
  dry?: boolean;
  /** Collapsing bridge: falls this long after the chain starts (seconds, before tempo). */
  collapseAfter?: number;
  /** A saw sweeps along it, this far through its cycle (0…1), so the saws move as a wave. */
  saw?: number;
  /** Solid for `on` of every `period` seconds, starting `at` seconds into the period (twist tempo only). */
  strike?: { period: number; on: number; at: number };
  /** An updraft column fills the gap before it. */
  updraft?: boolean;
  /** Orbiting asteroid: this far through its circle (0…1) at the start, so the belt turns as a wave. */
  orbit?: number;
  /** A meteor lands on it, this far through the shower's cycle (0…1), this far along it (−1…1 of its half-length). */
  meteor?: { at: number; along: number };
}

/** Bridge planks collapse one after another, this long apart, once the first is stepped on. */
const PLANK = 0.55;
/**
 * Lightning Sprint: each platform lights up this long after the one before. A hop takes
 * about 0.7 s, so a quick climber catches the wave and waits for the next strike. Not scaled
 * by the zone's tempo (only by the Turbo twist): any faster and nobody could keep up.
 */
const STRIKE = 0.85;

export const SET_PIECE_STEPS: Record<SetPieceId, StepSpec[]> = {
  // Long planks with short hops between: keep running and you stay just ahead of the fall.
  bridge: [0, 1, 2, 3].map((i) => ({ size: "long", kind: "crumble", rise: 0.12, gap: 0.35, collapseAfter: 1.4 + i * PLANK })),
  // Four blades sweeping a quarter-cycle apart: a wave to read, then jump through.
  saws: [0, 1, 2, 3].map((i) => ({ size: "long", kind: "static", rise: 0.55, gap: 0.8, saw: i / 4 })),
  // A ledge, then gaps too wide to jump: walk (or jump) into the rising air and it lifts you across.
  canyon: [
    { size: "big", kind: "static", rise: 0.6, gap: 0.9, dry: true },
    { size: "big", kind: "static", rise: 2.3, gap: 4, dry: true, updraft: true },
    { size: "long", kind: "static", rise: 0.8, gap: 0.9, dry: true },
    { size: "big", kind: "static", rise: 2.3, gap: 4, dry: true, updraft: true },
    { size: "long", kind: "static", rise: 0.7, gap: 0.9, dry: true },
  ],
  // Platforms appear one after another up the spiral and vanish behind you: ride the wave.
  lightning: [0, 1, 2, 3, 4, 5].map((i) => ({
    size: "normal",
    piece: "block-moving-blue",
    kind: "vanish",
    rise: 0.9,
    gap: 1.3,
    strike: { period: STRIKE * 6, on: STRIKE * 3, at: i * STRIKE },
  })),
  // Rocks circling a quarter-turn apart: each one swings near, then away. Hop on as it comes.
  asteroids: [0, 1, 2, 3, 4].map((i) => ({ size: "normal", kind: "orbit", rise: 0.7, gap: 1.2, orbit: i * 0.27 })),
  // Long ledges under a shower: the rings light up one ledge after another, so keep moving.
  meteors: [0, 1, 2, 3, 4, 5].map((i) => ({
    size: "long",
    kind: "static",
    rise: 0.75,
    gap: 1.5,
    dry: true,
    meteor: { at: (i * 0.3) % 1, along: i % 2 ? 0.45 : -0.45 },
  })),
};
