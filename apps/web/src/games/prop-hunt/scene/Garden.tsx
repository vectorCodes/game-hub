// The garden's living bits, drawn from Poly Haven models (art/models.ts): clumps of long grass
// across the grass patches, and a ring of trees beyond the fence so the world doesn't stop at
// it. Both are scenery: instanced, never collide, and the aim and zaps see straight through.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material, type Mesh } from "three";
import type { HouseMap } from "@shadow/shared";
import { modelSize, modelUrl, type ModelKey } from "../art/models";
import { noRaycast, seeded } from "./shapes";

/** A model drawn at many spots: one instanced mesh per piece of it. */
function Scattered({ model, spots, cast }: { model: ModelKey; spots: Matrix4[]; cast: boolean }) {
  const { scene } = useGLTF(modelUrl(model));
  const pieces = useMemo(() => {
    const out: { geometry: BufferGeometry; material: Material; matrix: Matrix4 }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) out.push({ geometry: mesh.geometry, material: mesh.material as Material, matrix: mesh.matrixWorld.clone() });
    });
    return out;
  }, [scene]);
  return (
    <>
      {pieces.map((p, i) => (
        <Piece key={i} geometry={p.geometry} material={p.material} matrices={spots.map((s) => s.clone().multiply(p.matrix))} cast={cast} />
      ))}
    </>
  );
}

function Piece({ geometry, material, matrices, cast }: { geometry: BufferGeometry; material: Material; matrices: Matrix4[]; cast: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} castShadow={cast} receiveShadow raycast={noRaycast} />;
}

const euler = new Euler();
const quat = new Quaternion();
const place = (x: number, z: number, yaw: number, s: number) => new Matrix4().compose(new Vector3(x, 0, z), quat.setFromEuler(euler.set(0, yaw, 0)), new Vector3(s, s, s));

/** Long grass: clumps about as tall as a mug, spread over each patch, the same way every time. */
export function GrassClumps({ map }: { map: HouseMap }) {
  const spots = useMemo(() => {
    const rand = seeded(11);
    // Clumps of about 0.9 units tall (grass_medium_02 is 0.41 tall): small props vanish in it.
    const base = 2.2;
    const [w] = modelSize("grass");
    const each = (w * base) ** 2 * 0.35;
    const out: Matrix4[] = [];
    for (const g of map.grass) {
      const n = Math.round(((g.x1 - g.x0) * (g.z1 - g.z0)) / each);
      for (let i = 0; i < n; i++) out.push(place(g.x0 + rand() * (g.x1 - g.x0), g.z0 + rand() * (g.z1 - g.z0), rand() * Math.PI * 2, base * (0.8 + rand() * 0.5)));
    }
    return out;
  }, [map]);
  return <Scattered model="grass" spots={spots} cast={false} />;
}

/** Trees all round, beyond the fence: you can't get to them; they're there so the garden isn't the edge of the world. */
export function TreeLine({ map }: { map: HouseMap }) {
  const spots = useMemo(() => {
    const rand = seeded(23);
    // The property's outline, from its blocks (walls, fence), and a ring a little outside it.
    const visible = map.blocks.filter((b) => b.color && b.y1 - b.y0 > 1);
    const x0 = Math.min(...visible.map((b) => b.x0));
    const x1 = Math.max(...visible.map((b) => b.x1));
    const z0 = Math.min(...visible.map((b) => b.z0));
    const z1 = Math.max(...visible.map((b) => b.z1));
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const rx = (x1 - x0) / 2 + 22;
    const rz = (z1 - z0) / 2 + 22;
    const [, h] = modelSize("tree");
    const out: Matrix4[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.15;
      const r = 1 + rand() * 0.25;
      out.push(place(cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * r, rand() * Math.PI * 2, (26 / h) * (0.8 + rand() * 0.5)));
    }
    return out;
  }, [map]);
  return <Scattered model="tree" spots={spots} cast={false} />;
}
