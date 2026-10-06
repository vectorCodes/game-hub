// The hole's tiles, standing on posts above the island, and the flag in the cup.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, Object3D } from "three";
import { usePutt } from "../store";
import { usePuttScene } from "./shared";

/** Posts under the course: the island's grass is this far below the tiles. */
export const ISLAND_DROP = 0.5;

function prepare(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return root;
}

export function Course({ kit }: { kit: Record<string, Object3D> }) {
  const { hole } = usePuttScene();
  const tiles = useMemo(
    () =>
      hole.tiles.map((t) => {
        const root = prepare(kit[t.piece].clone(true));
        root.position.set(t.x, t.y, t.z);
        root.rotation.y = (t.rot * Math.PI) / 2;
        return root;
      }),
    [hole, kit],
  );
  // A post under every other tile: enough to hold it up, not a forest.
  const posts = useMemo(
    () =>
      hole.tiles
        .filter((t) => (t.x + t.z) % 2 === 0)
        .map((t) => {
          const root = prepare(kit["support-low"].clone(true));
          root.position.set(t.x, t.y - ISLAND_DROP, t.z);
          return root;
        }),
    [hole, kit],
  );

  return (
    <group>
      {tiles.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      {posts.map((o, i) => (
        <primitive key={`p${i}`} object={o} />
      ))}
      <Flag kit={kit} />
    </group>
  );
}

/** The flag stands in the cup, and lifts out of the way as a ball gets close. */
function Flag({ kit }: { kit: Record<string, Object3D> }) {
  const { hole, world } = usePuttScene();
  const flag = useMemo(() => prepare(kit["flag-red"].clone(true)), [kit]);
  const group = useRef<Group>(null);
  const lift = useRef(0);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const phase = usePutt.getState().phase;
    const p = world.pos;
    const near = Math.hypot(p.x - hole.cup.x, p.z - hole.cup.z) < 1.4 && phase === "rolling";
    const goal = near || phase === "sunk" ? 1 : 0;
    lift.current += (goal - lift.current) * (1 - Math.exp(-dt * 6));
    g.position.set(hole.cup.x, hole.cup.y - 0.03 + lift.current * 0.35, hole.cup.z);
    // A lazy flutter.
    g.rotation.y = Math.sin(state.clock.elapsedTime * 1.3) * 0.12;
  });

  return (
    <group ref={group}>
      <primitive object={flag} />
    </group>
  );
}
