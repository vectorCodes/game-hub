// The ball: drawn between physics steps, spinning with its roll. It drops into the cup when
// sunk, and pops back where it was hit from after going out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Object3D } from "three";
import { BALL_RADIUS } from "../config";
import { usePutt } from "../store";
import { frameClock, onPuttEvent, usePuttScene } from "./shared";

const axis = new Vector3();
const turn = new Quaternion();

export function Ball({ kit }: { kit: Record<string, Object3D> }) {
  const { world, hole } = usePuttScene();
  const model = useMemo(() => {
    const root = kit["ball-red"].clone(true);
    root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
    return root;
  }, [kit]);
  const group = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const fx = useRef({ sink: 0, pop: 0, last: new Vector3() });

  useEffect(
    () =>
      onPuttEvent((e) => {
        if (e.type === "sink") fx.current.sink = 0.0001;
        if (e.type === "shot") fx.current.sink = 0;
      }),
    [],
  );

  // A fresh hole starts with the ball on the tee.
  useEffect(() => {
    fx.current.sink = 0;
    fx.current.pop = 1;
  }, [world]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const { phase } = usePutt.getState();
    const a = frameClock.alpha;
    const { prev, pos } = world;
    const f = fx.current;
    const x = prev.x + (pos.x - prev.x) * a;
    const y = prev.y + (pos.y - prev.y) * a;
    const z = prev.z + (pos.z - prev.z) * a;

    // Spin with the distance rolled since the last frame.
    const dx = x - f.last.x;
    const dz = z - f.last.z;
    const d = Math.hypot(dx, dz);
    if (spin.current && d > 1e-5 && d < 1) {
      axis.set(dz, 0, -dx).normalize();
      turn.setFromAxisAngle(axis, d / BALL_RADIUS);
      spin.current.quaternion.premultiply(turn);
    }
    f.last.set(x, y, z);

    // Into the cup: slide to its centre and drop out of sight.
    if (f.sink > 0) {
      f.sink = Math.min(1, f.sink + dt * 3.2);
      const k = f.sink;
      g.position.set(x + (hole.cup.x - x) * k, y - k * 0.09, z + (hole.cup.z - z) * k);
      g.scale.setScalar(1 - k * 0.35);
    } else {
      g.position.set(x, y, z);
      // Back on the green after going out: a little pop.
      f.pop = Math.max(0, f.pop - dt * 3);
      g.scale.setScalar(1 + Math.sin(f.pop * Math.PI) * 0.5);
    }
    g.visible = phase !== "out" && !(f.sink >= 1);

    // A soft ring round the ball while it waits, so it's easy to find.
    const m = marker.current;
    if (m) {
      m.visible = phase === "aim";
      m.position.set(x, world.lastRest.y - 0.03, z);
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3);
      m.scale.setScalar(1 + pulse * 0.25);
      (m.material as MeshBasicMaterial).opacity = 0.35 + pulse * 0.25;
    }
  });

  return (
    <>
      <group ref={group}>
        <group ref={spin}>
          <primitive object={model} />
        </group>
      </group>
      <mesh ref={marker} rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[BALL_RADIUS * 1.6, BALL_RADIUS * 2.1, 32]} />
        <meshBasicMaterial color="#ffffff" transparent depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  );
}
