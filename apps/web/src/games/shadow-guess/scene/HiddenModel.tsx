import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  Box3,
  DoubleSide,
  MeshBasicMaterial,
  Vector3,
  type Group,
  type Material,
  type Mesh,
} from "three";
import type { LightAngle } from "@shadow/shared";
import { angleToQuaternion } from "./angles";
import { useShadowSnapshots, type SnapshotHandler } from "./useShadowSnapshots";

/** Every object is scaled so its largest dimension is this long; size gives nothing away. */
const TARGET_SIZE = 4.2;
const FADE_SECONDS = 0.9;

interface Props {
  modelUrl: string;
  angle: LightAngle;
  revealed: boolean;
  /** Jump straight to `angle` instead of animating (angle picker sliders). */
  snap?: boolean;
  /** Angles to capture thumbnails for; only captured while the object is hidden. */
  snapshotAngles?: LightAngle[];
  onSnapshot?: SnapshotHandler;
  onReady?: () => void;
}

interface Part {
  mesh: Mesh;
  original: Material | Material[];
}

const each = (m: Material | Material[], fn: (m: Material) => void) =>
  Array.isArray(m) ? m.forEach(fn) : fn(m);

export function HiddenModel({
  modelUrl,
  angle,
  revealed,
  snap = false,
  snapshotAngles = [],
  onSnapshot,
  onReady,
}: Props) {
  const pivot = useRef<Group>(null);
  const { scene } = useGLTF(modelUrl);

  const { model, parts } = useMemo(() => {
    const model = scene.clone(true);
    const parts: Part[] = [];
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      parts.push({ mesh, original: mesh.material });
    });
    return { model, parts };
  }, [scene]);

  // colorWrite/depthWrite off: invisible to the camera, but still rendered into the shadow map.
  const hidden = useMemo(
    () => new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide }),
    [],
  );
  useEffect(() => () => hidden.dispose(), [hidden]);

  // Reveal fades the real materials in; clones keep the cached GLTF materials untouched.
  const fade = useRef<{ progress: number; materials: Material[] } | null>(null);
  const wasRevealed = useRef(revealed);
  useLayoutEffect(() => {
    const animate = revealed && !wasRevealed.current;
    wasRevealed.current = revealed;
    fade.current?.materials.forEach((m) => m.dispose());
    fade.current = null;

    if (!animate) {
      for (const { mesh, original } of parts) mesh.material = revealed ? original : hidden;
      return;
    }
    const materials: Material[] = [];
    for (const part of parts) {
      const clone = (m: Material) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0;
        materials.push(c);
        return c;
      };
      part.mesh.material = Array.isArray(part.original) ? part.original.map(clone) : clone(part.original);
    }
    fade.current = { progress: 0, materials };
  }, [parts, revealed, hidden]);

  useEffect(() => () => fade.current?.materials.forEach((m) => m.dispose()), []);

  useLayoutEffect(() => {
    // Center and scale in model space (the pivot carries the rotation).
    model.position.set(0, 0, 0);
    model.scale.setScalar(1);
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);
    model.position.copy(box.getCenter(new Vector3()).multiplyScalar(-scale));
  }, [model]);

  const target = useMemo(() => angleToQuaternion(angle), [angle]);
  const placed = useRef(false);
  useLayoutEffect(() => {
    // The first frame (and snap mode) starts exactly on the target angle.
    if (snap || !placed.current) {
      pivot.current!.quaternion.copy(target);
      placed.current = true;
    }
  }, [target, snap]);

  useEffect(() => onReady?.(), [onReady]);

  useShadowSnapshots(pivot, snapshotAngles, revealed ? undefined : onSnapshot);

  useFrame((_, delta) => {
    pivot.current!.quaternion.slerp(target, 1 - Math.exp(-delta * 4));

    const f = fade.current;
    if (!f) return;
    f.progress = Math.min(1, f.progress + delta / FADE_SECONDS);
    const opacity = f.progress * f.progress * (3 - 2 * f.progress); // smoothstep
    for (const m of f.materials) m.opacity = opacity;
    if (f.progress === 1) {
      for (const { mesh, original } of parts) mesh.material = original;
      f.materials.forEach((m) => m.dispose());
      fade.current = null;
    }
  });

  return (
    <group ref={pivot}>
      <primitive object={model} />
    </group>
  );
}
