// Bumper Arena: sumo in bumper rings. Players (and bots) drive round rings on a floating
// arena and shove each other off the edge; the last ring on it wins the round. See
// Bumper-arena-plan.md. This file holds the tuning and the maps; the physics is
// bumperSim.ts, the bots bumperBots.ts.

/** Everything that decides how a ring feels. One object, so the prototype can tune it live. */
export interface BumperTuning {
  /** Ring radius (m). */
  radius: number;
  /** Top driving speed (m/s). */
  maxSpeed: number;
  /** Driving acceleration (m/s²). */
  accel: number;
  /** Always-on drag (per second). */
  drag: number;
  /** Extra drag while the stick is let go, so you coast to a stop (per second). */
  brakeDrag: number;
  /** How fast a ring going over top speed (a knock, the end of a dash) slows back to it (m/s²). */
  overspeedDecel: number;
  dashSpeed: number;
  dashSeconds: number;
  dashCooldown: number;
  /** Mass while braced (a ring's mass is 1). */
  braceMass: number;
  /** Driving speed while braced, as a share of top speed. */
  braceSpeed: number;
  braceMaxSeconds: number;
  braceCooldown: number;
  /** Bounciness of ring-on-ring hits, 0–1. */
  restitution: number;
  /** Extra shove a hit gives on top of the bounce (m/s at full closing speed and 100% wobble). */
  knockBase: number;
  /** Share of that shove a ring still takes at 0% wobble. */
  knockFloor: number;
  /** A dashing ring's shove is this many times stronger. */
  dashKnock: number;
  /** Wobble (%) added by a dash hit, and by a plain bump at full closing speed. */
  wobbleDash: number;
  wobbleBump: number;
  wobbleMax: number;
  /** Wobble drained per second once nobody has touched you for `wobbleRestSeconds`. */
  wobbleDrain: number;
  wobbleRestSeconds: number;
  /** A ring that falls this soon after a hit is the hitter's knockout. */
  koWindow: number;
  gravity: number;
}

export const BUMPER_TUNING: BumperTuning = {
  radius: 0.6,
  maxSpeed: 5.5,
  accel: 18,
  drag: 0.6,
  brakeDrag: 2.6,
  overspeedDecel: 16,
  dashSpeed: 9.5,
  dashSeconds: 0.22,
  dashCooldown: 2.5,
  braceMass: 2,
  braceSpeed: 0.4,
  braceMaxSeconds: 1.5,
  braceCooldown: 2,
  restitution: 0.5,
  knockBase: 3,
  knockFloor: 0.2,
  dashKnock: 1.6,
  wobbleDash: 20,
  wobbleBump: 8,
  wobbleMax: 150,
  wobbleDrain: 3,
  wobbleRestSeconds: 1.5,
  koWindow: 3,
  gravity: 22,
};

export const BUMPER_COUNTDOWN_SECONDS = 3;
export const BUMPER_MAX_RINGS = 10;

// ---------- Maps ----------

export interface BumperMap {
  id: string;
  name: string;
  /** Arena radius (m) for 8 rings; fewer rings get a smaller arena (see arenaRadius). */
  radius: number;
  /** Sudden death: from `at` seconds into the round, the edge drops `step` metres every `every` seconds, down to `minRadius`. */
  suddenDeath: { at: number; every: number; step: number; minRadius: number; warnSeconds: number };
}

export const BUMPER_MAPS: Record<string, BumperMap> = {
  "picnic-plate": {
    id: "picnic-plate",
    name: "Picnic Plate",
    radius: 16,
    suddenDeath: { at: 60, every: 4, step: 1.25, minRadius: 3, warnSeconds: 1.5 },
  },
};

/** The arena shrinks with fewer rings, so 2 players don't spend a round looking for each other. */
export function arenaRadius(map: BumperMap, rings: number): number {
  const share = Math.min(1, Math.max(0, (rings - 2) / 6));
  return map.radius * (0.75 + 0.25 * share);
}
