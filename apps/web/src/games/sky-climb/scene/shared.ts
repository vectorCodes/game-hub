import { createContext, useContext, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { kitUrl, ZONES, type SkyLook } from "../config";
import type { Sim, SimEvent } from "../sim";

export const SimContext = createContext<Sim | null>(null);

export function useSim(): Sim {
  const sim = useContext(SimContext);
  if (!sim) throw new Error("useSim outside <SimContext>");
  return sim;
}

// Effects (dust puffs, sparkles) listen to the simulation's events.
type Listener = (e: SimEvent, sim: Sim) => void;
const listeners = new Set<Listener>();

export function onSimEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitSimEvent(e: SimEvent, sim: Sim) {
  for (const l of listeners) l(e, sim);
}

const tinted = new Map<string, Material>();

/**
 * A fresh copy of a Kenney kit piece. Geometry is shared; materials are shared too, tinted
 * per zone, unless `own` asks for private ones (for platforms that fade out).
 */
export function useKit(piece: string, tint = "#ffffff", own = false): Object3D {
  const { scene } = useGLTF(kitUrl(piece));
  return useMemo(() => {
    const root = scene.clone(true);
    const color = new Color(tint);
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const source = mesh.material as MeshStandardMaterial;
      if (own) {
        const m = source.clone();
        m.color.multiply(color);
        m.transparent = true;
        mesh.material = m;
      } else if (tint !== "#ffffff") {
        const key = `${source.uuid}:${tint}`;
        let m = tinted.get(key);
        if (!m) {
          const t = source.clone();
          t.color.multiply(color);
          tinted.set(key, (m = t));
        }
        mesh.material = m;
      }
    });
    return root;
  }, [scene, tint, own]);
}

/** Every material under an object, for fading it in and out. */
export function materialsOf(root: Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) out.push(mesh.material as MeshStandardMaterial);
  });
  return out;
}

const KIT_PIECES = [
  ...new Set(ZONES.flatMap((z) => [...Object.values(z.pieces), z.core, ...z.deco])),
  "block-moving",
  "block-moving-blue",
  "conveyor-belt",
  "spring",
  "saw",
  "trap-spikes",
  "coin-gold",
  "flag",
  "chest",
  "tree",
  "flowers",
];

export function preloadKit() {
  for (const piece of KIT_PIECES) useGLTF.preload(kitUrl(piece));
}

const a = new Color();
const b = new Color();

/**
 * The sky, fog and light at a height, blended between zones over the last three floors of
 * each one, so climbing feels like the day passing.
 */
export function lookAt(height: number, out: Record<keyof SkyLook, Color | number>) {
  let i = 0;
  while (i + 1 < ZONES.length && height >= ZONES[i + 1].from) i++;
  const here = ZONES[i].sky;
  const next = ZONES[Math.min(i + 1, ZONES.length - 1)];
  const t = i + 1 < ZONES.length ? Math.min(1, Math.max(0, (height - (next.from - 3)) / 3)) : 0;
  for (const key of Object.keys(here) as (keyof SkyLook)[]) {
    const from = here[key];
    const to = next.sky[key];
    if (typeof from === "number" && typeof to === "number") {
      out[key] = from + (to - from) * t;
    } else {
      (out[key] as Color).copy(a.set(from as string).lerp(b.set(to as string), t));
    }
  }
}

export function newLook(): Record<keyof SkyLook, Color | number> {
  return {
    top: new Color(),
    bottom: new Color(),
    fog: new Color(),
    sun: new Color(),
    sunIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 0,
  };
}
