// Where everything sits in the landing world. The path runs from the clearing (z ≈ 0)
// down to the glade (z ≈ −60); the camera visits one stop per page section.

export type V3 = [number, number, number];

/** The footpath wanders gently from side to side. */
export const pathX = (z: number) => Math.sin(z * 0.06) * 1.2;

export const MOON: V3 = [34, 46, -110];

/** Lamp posts: lantern positions (the posts stand underneath). */
export const LAMPS: V3[] = [
  [-3.6, 3.9, 4],
  [3.8, 3.9, -6],
  [-4.2, 3.9, -40],
  [4.6, 3.9, -52],
];

/** The shadow wall, its lantern, and the hidden object between them. */
export const WALL = { center: [0, 2.6, -24] as V3, width: 9, height: 5.2 };
export const WALL_LANTERN: V3 = [1.6, 3.4, -12];
export const HIDDEN_OBJECT: V3 = [0, 2.6, -18.5];

export const GLADE = { center: [0, 0, -60] as V3, radius: 6 };

/** Camera position and look-at target for each section of the page, in order. */
export const STOPS: { position: V3; target: V3 }[] = [
  { position: [0, 1.7, 12], target: [0, 3.4, -10] }, // hero: the clearing
  { position: [-1.2, 2.3, -6], target: [0.2, 2.5, -24] }, // study the shadow
  { position: [7.4, 3.0, -12.6], target: [-3.6, 2.5, -21.5] }, // behind the scenes
  { position: [2.6, 2.4, -32], target: [0, 2.2, -56] }, // trailer: down the path
  { position: [0, 4.2, -46.5], target: [0, 1.8, -60] }, // the glade
  { position: [0, 3, -56], target: [8, 26, -110] }, // up to the moon
];

/** Small deterministic PRNG so the forest is the same on every visit. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Kept clear of trees and grass: the path, the clearing, the wall and the glade. */
export function isOpen(x: number, z: number, margin = 0) {
  if (Math.abs(x - pathX(z)) < 1 + margin) return true;
  if (Math.hypot(x, z - 3) < 5 + margin) return true;
  if (Math.abs(x) < 6 + margin && z < -8 + margin && z > -27 - margin) return true;
  if (Math.hypot(x - GLADE.center[0], z - GLADE.center[2]) < GLADE.radius + 3 + margin) return true;
  return false;
}
