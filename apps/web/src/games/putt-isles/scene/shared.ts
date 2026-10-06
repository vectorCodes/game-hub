import { createContext, useContext, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Matrix4, Vector3, type BufferGeometry, type Mesh, type Object3D } from "three";
import { kitUrl } from "../config";
import type { HoleLayout } from "../course";
import type { PuttEvent, PuttWorld } from "../physics";
import type { PieceTriangles } from "../collision";

export interface PuttScene {
  world: PuttWorld;
  hole: HoleLayout;
}

export const PuttContext = createContext<PuttScene | null>(null);

export function usePuttScene(): PuttScene {
  const scene = useContext(PuttContext);
  if (!scene) throw new Error("usePuttScene outside <PuttContext>");
  return scene;
}

/** How far between the last two physics steps this frame is drawn (0–1). */
export const frameClock = { alpha: 1 };

// Effects (bounce sparks, the cup's flag) listen to the physics' events.
type Listener = (e: PuttEvent, world: PuttWorld) => void;
const listeners = new Set<Listener>();

export function onPuttEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitPuttEvent(e: PuttEvent, world: PuttWorld) {
  for (const l of listeners) l(e, world);
}

/** Loads kit pieces (suspends until they're in), keyed by piece name. */
export function useKitPieces(pieces: string[]): Record<string, Object3D> {
  const gltfs = useGLTF(pieces.map(kitUrl));
  const scenes = gltfs.map((g) => g.scene);
  // Same models, same object: the collision mesh and the world are built once per hole.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => Object.fromEntries(pieces.map((p, i) => [p, scenes[i]])), scenes);
}

export function preloadPieces(pieces: string[]) {
  for (const p of pieces) useGLTF.preload(kitUrl(p));
}

const v = new Vector3();
const m = new Matrix4();

/** A loaded piece's triangles in its own space, for the physics. */
export function pieceTriangles(root: Object3D): PieceTriangles {
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const out: number[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as BufferGeometry;
    const pos = g.getAttribute("position");
    const index = g.getIndex();
    m.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const n = index ? index.count : pos.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
      out.push(v.x, v.y, v.z);
    }
  });
  return new Float32Array(out);
}
