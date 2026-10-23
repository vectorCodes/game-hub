// Pickups and banana patches, drawn from the sim every frame. A pickup pulses on the floor
// for a moment first (so nobody gets one by pure luck), then floats in a glassy bubble with its
// icon inside: an anvil, a lightning bolt, a shockwave ring, a bubble, a banana. A small pool
// of meshes is reused; nothing is created while a round is on.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { PICKUP_KINDS, PICKUPS, type PickupKind } from "@shadow/shared";
import { game } from "../store";

const PICKUP_SLOTS = 3;
const PATCH_SLOTS = 8;

export const PICKUP_COLORS: Record<PickupKind, string> = {
  heavy: "#6b7280",
  turbo: "#f2b33d",
  shock: "#4f8fe0",
  bubble: "#7fd0f0",
  banana: "#f2d03d",
};

/** One kind's icon, about 0.5 m across. */
function Icon({ kind }: { kind: PickupKind }) {
  const color = PICKUP_COLORS[kind];
  switch (kind) {
    case "heavy":
      return (
        <group scale={0.9}>
          <mesh position-y={-0.08}>
            <boxGeometry args={[0.22, 0.12, 0.2]} />
            <meshStandardMaterial color="#4b5160" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position-y={0.05}>
            <boxGeometry args={[0.42, 0.14, 0.22]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      );
    case "turbo":
      return (
        <group rotation-z={0.35}>
          <mesh position={[0.04, 0.1, 0]} rotation-z={Math.PI}>
            <coneGeometry args={[0.1, 0.28, 3]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[-0.04, -0.1, 0]}>
            <coneGeometry args={[0.1, 0.28, 3]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    case "shock":
      return (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.18, 0.05, 8, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      );
    case "bubble":
      return (
        <mesh>
          <sphereGeometry args={[0.17, 16, 12]} />
          <meshStandardMaterial color={color} transparent opacity={0.75} roughness={0.1} />
        </mesh>
      );
    case "banana":
      return (
        <mesh rotation={[0, 0, Math.PI * 0.75]}>
          <torusGeometry args={[0.16, 0.06, 8, 16, Math.PI * 0.9]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      );
  }
}

function PickupSlot({ slot }: { slot: number }) {
  const root = useRef<Group>(null);
  const float = useRef<Group>(null);
  const icons = useRef<(Group | null)[]>([]);
  const halo = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const p = game.sim?.pickups[slot];
    const g = root.current;
    if (!g) return;
    g.visible = !!p;
    if (!p || !game.sim) return;
    const t = clock.elapsedTime;
    const k = Math.min(1, Math.max(0, (game.sim.t - p.at) / PICKUPS.warn));
    g.position.set(p.x, 0, p.z);
    if (float.current) {
      float.current.position.y = 0.75 + Math.sin(t * 3 + slot) * 0.08;
      float.current.rotation.y = t * 1.6;
      float.current.scale.setScalar(0.2 + 0.8 * k);
    }
    icons.current.forEach((icon, i) => icon && (icon.visible = PICKUP_KINDS[i] === p.kind));
    // The floor halo: a quick pulse while it's on its way, a slow one once it can be taken.
    if (halo.current) {
      const m = halo.current.material as MeshBasicMaterial;
      m.color.set(PICKUP_COLORS[p.kind]);
      m.opacity = k < 1 ? 0.35 + 0.35 * Math.abs(Math.sin(t * 14)) : 0.35 + 0.15 * Math.sin(t * 3);
      halo.current.scale.setScalar(k < 1 ? 0.6 + 0.4 * k : 1);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={halo} rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[0.45, 0.62, 32]} />
        <meshBasicMaterial transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <group ref={float}>
        <mesh castShadow>
          <sphereGeometry args={[0.38, 20, 14]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.28} roughness={0.05} />
        </mesh>
        {PICKUP_KINDS.map((kind, i) => (
          <group key={kind} ref={(el) => void (icons.current[i] = el)} visible={false}>
            <Icon kind={kind} />
          </group>
        ))}
      </group>
    </group>
  );
}

function PatchSlot({ slot }: { slot: number }) {
  const root = useRef<Group>(null);
  useFrame(() => {
    const b = game.sim?.patches[slot];
    const g = root.current;
    if (!g) return;
    g.visible = !!b;
    if (b) g.position.set(b.x, 0, b.z);
  });
  return (
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[PICKUPS.banana.radius, 28]} />
        <meshStandardMaterial color="#f2d03d" transparent opacity={0.55} roughness={0.15} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0.6]} position-y={0.06}>
        <torusGeometry args={[0.22, 0.06, 6, 14, Math.PI * 0.9]} />
        <meshStandardMaterial color="#d9b52a" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Pickups() {
  return (
    <>
      {Array.from({ length: PICKUP_SLOTS }, (_, i) => (
        <PickupSlot key={i} slot={i} />
      ))}
      {Array.from({ length: PATCH_SLOTS }, (_, i) => (
        <PatchSlot key={i} slot={i} />
      ))}
    </>
  );
}
