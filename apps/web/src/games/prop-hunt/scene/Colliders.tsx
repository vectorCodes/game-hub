// Dev only (C toggles it): every collider as a wireframe box over the art, to check that seats,
// table tops and shelves are where the models show them.
import { useLayoutEffect, useRef } from "react";
import { BoxGeometry, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type InstancedMesh } from "three";
import type { HuntSim } from "../sim";

const GEOMETRY = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const MATERIAL = new MeshBasicMaterial({ color: "#ff3d7f", wireframe: true, depthTest: false, transparent: true, opacity: 0.6 });

export function Colliders({ sim }: { sim: HuntSim }) {
  const ref = useRef<InstancedMesh>(null);
  const boxes = sim.colliders;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(new Vector3((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2), q, new Vector3(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0))));
    mesh.instanceMatrix.needsUpdate = true;
  }, [boxes]);
  return <instancedMesh ref={ref} args={[GEOMETRY, MATERIAL, boxes.length]} renderOrder={10} frustumCulled={false} raycast={() => {}} />;
}
