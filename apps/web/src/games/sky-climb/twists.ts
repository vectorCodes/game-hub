// What each daily twist does to the climb. Which tower gets which twist is decided in
// shared code (`twistOf`), so the server can count them for the "Twisted" achievement.
import { TWIST_IDS, twistOf, type TwistId } from "@shadow/shared";

export interface TwistRules {
  /** Multiplies the climber's physics (PHYS). */
  phys?: { gravity?: number; jumpSpeed?: number; springSpeed?: number; maxFall?: number; runSpeed?: number };
  /** Every non-checkpoint platform is icy. */
  ice?: boolean;
  /** The spiral winds the other way round. */
  mirror?: boolean;
  /** Dark sky all the way up, and a lantern on the climber. */
  night?: boolean;
  /** Multiplies the tempo of movers, saws and vanishing platforms. */
  tempo?: number;
  /** Wind gusts from this zone (index) up, whatever the zone. */
  windFrom?: number;
  /** Chance of a coin over a gap, and of a row of coins on a big platform. */
  coins?: { gap: number; row: number };
}

export const TWIST_RULES: Record<TwistId, TwistRules> = {
  // Apex ≈ (0.8·v)² / (2·0.6·g) ≈ 1.07× a normal jump, with far more hang time.
  moon: { phys: { gravity: 0.6, jumpSpeed: 0.8, springSpeed: 0.8, maxFall: 0.7 } },
  ice: { ice: true },
  mirror: { mirror: true },
  night: { night: true },
  turbo: { tempo: 1.3, phys: { runSpeed: 1.15 } },
  gale: { windFrom: 1 },
  gold: { coins: { gap: 1, row: 0.8 } },
};

/** Dev only: `?twist=moon` (or `?twist=none`) forces a twist on every tower, for testing. */
const forced: TwistId | "none" | null = (() => {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("twist");
  return t === "none" || (TWIST_IDS as readonly string[]).includes(t ?? "") ? (t as TwistId | "none") : null;
})();

/** The twist a tower is built and played with. */
export function towerTwist(seed: string): TwistId | null {
  if (forced) return forced === "none" ? null : forced;
  return twistOf(seed);
}

export const rulesOf = (twist: TwistId | null): TwistRules => (twist ? TWIST_RULES[twist] : {});
