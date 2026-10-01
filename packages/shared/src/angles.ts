/** Direction the light shines from, relative to the object, in degrees. */
export interface LightAngle {
  azimuth: number;
  elevation: number;
}

/** Ordered hardest → easiest: starts top-down, ends on a clean side profile. */
export const DEFAULT_ANGLES: LightAngle[] = [
  { azimuth: 0, elevation: 90 },
  { azimuth: 35, elevation: 65 },
  { azimuth: 160, elevation: 40 },
  { azimuth: 0, elevation: 15 },
  { azimuth: 55, elevation: 10 },
  { azimuth: 90, elevation: 0 },
];
