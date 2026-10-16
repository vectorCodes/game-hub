// Everything that tunes how Prop Hunt moves and looks at the world. Balancing movement should
// only ever mean editing this file.

export const PHYS = {
  gravity: 34,
  /**
   * Apex ≈ jumpSpeed² / 2g ≈ 3.2 units. The house's climbing routes (chair → table,
   * stool → counter → shelves, shelf → shelf) ask for at most 2.9.
   */
  jumpSpeed: 14.75,
  /** Releasing jump early cuts the rise to this fraction, for short hops. */
  jumpCut: 0.45,
  runSpeed: 5.5,
  /** Sprint multiplies the run speed; a full bar lasts `sprintFor` s and refills in `sprintRefill` s. */
  sprint: 1.6,
  sprintFor: 3,
  sprintRefill: 4,
  groundAccel: 50,
  airAccel: 22,
  coyote: 0.11,
  jumpBuffer: 0.13,
  maxFall: 30,
  /** The avatar's collider: a square this far out from its centre, and this tall. */
  half: 0.24,
  height: 0.9,
  /** Ledges up to this high are walked onto (stairs are 0.75 a step). */
  step: 0.8,
} as const;

export const CAMERA = {
  /** Distance behind the avatar, and the range the mouse wheel moves it in. */
  distance: 3.8,
  minDistance: 1.6,
  maxDistance: 9,
  /** Looked-at point above the avatar's feet; a prop is looked at from as far above its top. */
  lift: 1.15,
  /** Up/down look limits (radians; positive looks down at the avatar). */
  minPitch: -0.35,
  maxPitch: 1.25,
  /** Radians per pixel of mouse movement. */
  sensitivity: 0.0026,
  fov: 62,
  /** Resting tilt, and the tilt while going up or down stairs (looking up them, or down them). */
  pitch: 0.32,
  pitchClimbing: 0.08,
  pitchDescending: 0.6,
  /** Follow cam: after this long without the mouse, the camera swings round behind you as you move. */
  followDelay: 0.8,
  /** How fast it swings (radians a second at full speed, straight ahead). */
  followRate: 2.4,
  /** How fast the tilt eases towards the stairs' tilt. */
  pitchRate: 2,
} as const;

/** Below this the player has fallen out of the world and goes back to a spawn. */
export const FALL_LIMIT = -10;

export const AIM = {
  /** You can become a prop this far from you (measured to its nearest side). */
  reach: 4.5,
  /** How far from the middle of the view (radians) a prop can be and still count as looked at. */
  cone: 0.44,
  /** Seconds between aim checks: raycasting the whole house every frame isn't needed. */
  every: 0.05,
  outline: "#f5c04a",
} as const;

export const PROP_HUNT_HOME = "/games/prop-hunt";
export const PROP_HUNT_PATH = `${PROP_HUNT_HOME}/play`;
