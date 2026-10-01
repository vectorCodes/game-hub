import { createContext, useContext } from "react";

/**
 * Rendering budget for the landing world.
 *
 * `weak` is decided once at load (phones, ≤4 CPU cores) and changes how the world is built:
 * no real lamp lights (a painted glow instead), a smaller shadow map, fewer instances.
 * `level` then steps down at runtime if the measured frame rate can't keep up; see
 * PERFORMANCE_LEVELS.
 */
export type Quality = { weak: boolean; level: number };

export const PERFORMANCE_LEVELS = [
  { dpr: 1.6, bloom: true, density: 1 }, // full
  { dpr: 1.25, bloom: true, density: 1 }, // sharper → softer
  { dpr: 1, bloom: false, density: 1 }, // drop the glow pass
  { dpr: 1, bloom: false, density: 0.5 }, // half the grass and trees
] as const;

export const QualityContext = createContext<Quality>({ weak: false, level: 0 });
export const useQuality = () => useContext(QualityContext);

export function detectWeakDevice() {
  const small = window.matchMedia("(max-width: 768px)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return small || cores <= 4;
}
