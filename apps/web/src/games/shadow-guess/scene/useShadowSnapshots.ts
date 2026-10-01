import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { LightAngle } from "@shadow/shared";
import { angleToQuaternion } from "./angles";

const THUMB_WIDTH = 240;
/** Thumbnails show the middle of the wall, where the shadow is. */
const CROP = 0.7;

export type SnapshotHandler = (index: number, dataUrl: string) => void;

/**
 * Captures one thumbnail per angle, at most one per frame. Each capture poses the object at
 * that angle, renders, reads the canvas, and restores the pose before R3F's own render in
 * the same frame, so nothing flickers on screen.
 */
export function useShadowSnapshots(
  pivot: RefObject<Group | null>,
  angles: LightAngle[],
  onSnapshot: SnapshotHandler | undefined,
) {
  const { gl, scene, camera } = useThree();
  const captured = useRef(new Set<number>());
  const canvas = useMemo(() => document.createElement("canvas"), []);

  useFrame(() => {
    if (!onSnapshot || !pivot.current) return;
    const index = angles.findIndex((_, i) => !captured.current.has(i));
    if (index < 0) return;
    captured.current.add(index);

    const saved = pivot.current.quaternion.clone();
    pivot.current.quaternion.copy(angleToQuaternion(angles[index]));
    gl.render(scene, camera);

    const src = gl.domElement;
    const sw = src.width * CROP;
    const sh = src.height * CROP;
    canvas.width = THUMB_WIDTH;
    canvas.height = Math.round((THUMB_WIDTH * sh) / sw);
    canvas
      .getContext("2d")!
      .drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    onSnapshot(index, canvas.toDataURL("image/webp", 0.8));

    pivot.current.quaternion.copy(saved);
  });
}
