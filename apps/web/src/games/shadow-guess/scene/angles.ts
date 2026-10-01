import { Euler, MathUtils, Quaternion } from "three";
import type { LightAngle } from "@shadow/shared";

export function angleToQuaternion({ azimuth, elevation }: LightAngle): Quaternion {
  // The light is fixed and the object turns; the shadow is the same as moving the light
  // around the object, but it always lands on the wall facing the camera.
  return new Quaternion().setFromEuler(
    new Euler(MathUtils.degToRad(elevation), MathUtils.degToRad(azimuth), 0, "XYZ"),
  );
}

/** Where the object turns to once it's revealed: a three-quarter view. */
export const REVEAL_ANGLE: LightAngle = { azimuth: 35, elevation: 20 };
