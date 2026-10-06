// Putt Isles tuning: physics, aiming and the camera. Balance the feel here.

export const PUTT_ISLES_HOME = "/games/putt-isles";
export const PUTT_ISLES_PATH = "/games/putt-isles/play";

export const kitUrl = (piece: string) => `/putt-isles/kit/${piece}.glb`;

/** Kenney Minigolf Kit units: one tile is 1 × 1, the green's surface sits at this height. */
export const FLOOR_Y = 0.063;
/** The kit's ball. */
export const BALL_RADIUS = 0.035;

export const PHYSICS = {
  /** Fixed simulation step (s). Fixed so a shot plays out the same everywhere. */
  tick: 1 / 120,
  gravity: 9.81,
  /** Fastest shot (m/s), at full power: rolls about 8 m on the flat. */
  maxSpeed: 5.5,
  /** Power curve: 1 is linear; above 1 gives finer control over short putts. */
  powerCurve: 1.35,
  /** How the ball slows on the green: drag that grows with speed, plus a steady rolling
   *  resistance (m/s²) that brings it to a clean stop instead of a long crawl. */
  linearDamping: 0.4,
  rollingResistance: 0.6,
  /** Bounce off walls, and off the green (small, so drops don't hop). */
  wallRestitution: 0.62,
  floorRestitution: 0.15,
  /** Below this speed (m/s) for `stopTime` seconds, the ball comes to rest. */
  stopSpeed: 0.06,
  stopTime: 0.3,
  /** A roll this long (s) is stopped where it is (a ball circling a bowl forever). */
  maxRollTime: 25,
  /** Fallen this far below the green: out of bounds. */
  killDepth: 1.2,
} as const;

export const CUP = {
  /** The ball drops in when its centre is this close to the cup's centre… */
  captureRadius: 0.06,
  /** …and it's slower than this (m/s). Faster, and it rolls over or lips out. */
  maxSpeed: 1.35,
} as const;

export const AIM = {
  /** Pixels of drag (as a share of the shorter screen side) for full power. */
  fullPull: 0.32,
  /** Shorter drags than this (share of full power) are cancelled, not shot. */
  minPower: 0.04,
  /** The aim line: its length at no power and at full power (m). */
  lineMin: 0.35,
  lineMax: 2.6,
} as const;

export const CAMERA = {
  /** Distance behind the ball and the angle down onto it. */
  distance: 2.3,
  minDistance: 1.1,
  maxDistance: 5.5,
  pitch: 0.72,
  /** Radians per second when rotating with the keys or buttons. */
  turnSpeed: 2.2,
} as const;
