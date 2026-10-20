// The seekers' scanner: a ring sweeps out from the seeker who used it (everyone sees it), and
// for that seeker every real thing to hide as inside it glows for a moment. Hiders and decoys
// don't, so the one that stays plain is the one to zap.
import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import { HUNT_SCAN_MS, HUNT_SCAN_RANGE, type MapProp } from "@shadow/shared";
import { play } from "../../../lib/sound";
import { onScan } from "../net";
import { useHuntRoom } from "../room";
import type { HuntSim } from "../sim";
import { PropModel, SCAN_OUTLINE } from "./PropArt";

/** How long the ring takes to reach the edge of the scan. */
const SWEEP = 0.7;

export function ScanPulse({ sim }: { sim: HuntSim }) {
  const { you } = useHuntRoom();
  const ring = useRef<Mesh>(null);
  const pulse = useRef({ life: 0, x: 0, y: 0, z: 0 });
  const [glowing, setGlowing] = useState<MapProp[]>([]);

  useEffect(
    () =>
      onScan((by, [x, y, z], near) => {
        pulse.current = { life: SWEEP, x, y, z };
        if (near) play("scanWarn");
        if (by !== you) return;
        play("scan");
        const map = sim.map;
        setGlowing(map.props.filter((p) => map.kinds[p.kind].disguise && Math.hypot(p.x - x, p.y - y, p.z - z) <= HUNT_SCAN_RANGE));
      }),
    [you, sim],
  );

  useEffect(() => {
    if (!glowing.length) return;
    const id = setTimeout(() => setGlowing([]), HUNT_SCAN_MS);
    return () => clearTimeout(id);
  }, [glowing]);

  useFrame((_, dt) => {
    const r = ring.current;
    if (!r) return;
    const p = pulse.current;
    p.life = Math.max(0, p.life - dt);
    r.visible = p.life > 0;
    if (!r.visible) return;
    const k = 1 - p.life / SWEEP;
    r.position.set(p.x, p.y + 0.1, p.z);
    r.scale.setScalar(0.5 + k * HUNT_SCAN_RANGE);
    (r.material as MeshBasicMaterial).opacity = (1 - k) * 0.8;
  });

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} raycast={() => {}}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color="#7ef0ff" transparent depthWrite={false} />
      </mesh>
      {glowing.map((p) => (
        <group key={p.id} position={[p.x, p.y, p.z]} rotation-y={(p.turn * Math.PI) / 2}>
          <Suspense fallback={null}>
            <PropModel kind={sim.map.kinds[p.kind]} outline={0.05} glow={SCAN_OUTLINE} />
          </Suspense>
        </group>
      ))}
    </>
  );
}
