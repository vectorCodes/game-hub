// The seekers' sonar: for a few seconds, an arrow on the ground around you points the way to
// the nearest hider (the way, not how far), and a ring pings outward.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { play } from "../../../lib/sound";
import { onSonar } from "../net";
import type { HuntSim } from "../sim";

const SHOW_FOR = 3;

export function SonarArrow({ sim }: { sim: HuntSim }) {
  const root = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const state = useRef({ life: 0, yaw: 0 });

  useEffect(
    () =>
      onSonar(([dx, dz]) => {
        state.current = { life: SHOW_FOR, yaw: Math.atan2(dx, dz) };
        play("sonar");
      }),
    [],
  );

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const s = state.current;
    s.life = Math.max(0, s.life - dt);
    g.visible = s.life > 0;
    if (!g.visible) return;
    const pl = sim.player;
    g.position.set(pl.x, pl.y + 0.08, pl.z);
    g.rotation.y = s.yaw;
    const fade = Math.min(1, s.life / 0.5);
    const r = ring.current;
    if (r) {
      // A ping every second, growing outward.
      const t = (SHOW_FOR - s.life) % 1;
      r.scale.setScalar(1 + t * 5);
      (r.material as MeshBasicMaterial).opacity = (1 - t) * 0.7 * fade;
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} raycast={() => {}}>
        <ringGeometry args={[0.6, 0.72, 40]} />
        <meshBasicMaterial color="#7ef0ff" transparent depthWrite={false} />
      </mesh>
      {/* The arrow: a flat cone lying on the ground, pointing along +z (turned by the group). */}
      <mesh position={[0, 0, 1.6]} rotation-x={Math.PI / 2} raycast={() => {}}>
        <coneGeometry args={[0.35, 0.9, 3]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}
