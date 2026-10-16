// The plain materials things are made of (no texture: the part's own colour, with the right
// sheen), shared by everything drawn from parts. One material per surface and colour, cached,
// so a real mug and a hider disguised as one use the very same material.
import { MeshStandardMaterial } from "three";

interface Sheen {
  roughness: number;
  metalness?: number;
}

/** Sheen by surface. Textured surfaces (oak, marble, floors…) live in scene/Shell.tsx. */
export const PLAIN: Record<string, Sheen> = {
  paint: { roughness: 0.55 },
  ceramic: { roughness: 0.12 },
  enamel: { roughness: 0.22 },
  metal: { roughness: 0.35, metalness: 0.85 },
  fabric: { roughness: 0.95 },
  cloth: { roughness: 0.8 },
  leather: { roughness: 0.5 },
  rubber: { roughness: 0.9 },
  plastic: { roughness: 0.35 },
};

/** Greybox parts (no surface): the look the house had before the art. */
const GREYBOX: Sheen = { roughness: 0.85 };

const cache = new Map<string, MeshStandardMaterial>();

/** The material for a part made of `surface` (or nothing) in `color`. */
export function partMaterial(surface: string | undefined, color: string): MeshStandardMaterial {
  const key = `${surface ?? ""}:${color}`;
  let m = cache.get(key);
  if (!m) {
    const s = (surface && PLAIN[surface]) || GREYBOX;
    cache.set(key, (m = new MeshStandardMaterial({ color, roughness: s.roughness, metalness: s.metalness ?? 0 })));
  }
  return m;
}
