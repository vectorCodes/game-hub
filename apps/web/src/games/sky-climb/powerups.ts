// The climber's active power-ups (seconds left), copied from the simulation every frame so
// the HUD can show them without reaching into the 3D scene.
import type { PowerupKind } from "./config";

export const liveEffects: Record<PowerupKind, number> = { feather: 0, doubleJump: 0, shield: 0, magnet: 0 };

/** The cannon being aimed, if any: its power meter (0…1), for the HUD's gauge. */
export const liveCannon = { aiming: false, meter: 0 };
