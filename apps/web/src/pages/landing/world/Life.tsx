import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Shape,
  ShapeGeometry,
  type Group,
  type Mesh,
} from "three";
import { windTime } from "./Nature";
import { LAMPS, type V3 } from "./layout";
import { useQuality } from "./quality";

const LANTERN_GLOW: [number, number, number] = [2.2, 1.45, 0.6];

/** A wrought-iron lamp post with a glowing lantern (bloom picks up the emissive core). */
/** A soft round glow, used in place of a real light on weaker devices. */
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,214,140,0.85)");
    r.addColorStop(0.3, "rgba(255,200,120,0.3)");
    r.addColorStop(1, "rgba(255,190,110,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
}

export function LampPost({ lantern, light = true }: { lantern: V3; light?: boolean }) {
  const [x, y, z] = lantern;
  const { weak } = useQuality();
  const glow = useGlowTexture();
  return (
    <group>
      <mesh position={[x, y / 2 - 0.2, z]}>
        <cylinderGeometry args={[0.06, 0.09, y - 0.4, 8]} />
        <meshStandardMaterial color="#2a2216" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[x, 0.15, z]}>
        <cylinderGeometry args={[0.22, 0.28, 0.3, 8]} />
        <meshStandardMaterial color="#2a2216" roughness={0.6} metalness={0.4} />
      </mesh>
      <group position={lantern}>
        <mesh>
          <boxGeometry args={[0.2, 0.3, 0.2]} />
          <meshStandardMaterial color={LANTERN_GLOW} emissive={LANTERN_GLOW} emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Iron cage: four corner bars, a base plate and a pointed cap. */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.13, 0, sz * 0.13]}>
            <boxGeometry args={[0.035, 0.42, 0.035]} />
            <meshStandardMaterial color="#2a2216" roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.32, 0.04, 0.32]} />
          <meshStandardMaterial color="#2a2216" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.26, 0.2, 4]} />
          <meshStandardMaterial color="#2a2216" roughness={0.6} metalness={0.4} />
        </mesh>
        {light && !weak && <pointLight color="#ffc978" intensity={6} distance={12} decay={1.6} />}
        {weak && (
          <sprite scale={[2.6, 2.6, 1]}>
            <spriteMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        )}
      </group>
    </group>
  );
}

export function Lamps() {
  return (
    <>
      {LAMPS.map((l, i) => (
        <LampPost key={i} lantern={l} />
      ))}
    </>
  );
}

/** A bat silhouette: scalloped wings that flap on long loops; by day, ink birds against the paper sky. */
function useBatWing() {
  return useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.6, 0.45, 1.3, 0.35);
    s.quadraticCurveTo(1.15, 0.05, 1.25, -0.15);
    s.quadraticCurveTo(1.0, -0.05, 0.85, -0.25);
    s.quadraticCurveTo(0.65, -0.05, 0.45, -0.22);
    s.quadraticCurveTo(0.3, -0.05, 0, -0.1);
    s.closePath();
    // Lay the wing flat (span along +x, leading edge forward along +z).
    return new ShapeGeometry(s, 8).rotateX(Math.PI / 2);
  }, []);
}

const BATS = [
  { center: [6, 17, -70] as V3, rx: 30, rz: 20, speed: 0.22, phase: 0, bob: 2.5 },
  { center: [-4, 22, -85] as V3, rx: 36, rz: 16, speed: 0.17, phase: 2.2, bob: 3 },
  { center: [10, 13, -55] as V3, rx: 22, rz: 14, speed: 0.28, phase: 4.1, bob: 1.8 },
];

export function Bats() {
  const wing = useBatWing();
  const bats = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const t = windTime.value;
    BATS.forEach((b, i) => {
      const g = bats.current[i];
      if (!g) return;
      const a = t * b.speed + b.phase;
      const x = b.center[0] + Math.cos(a) * b.rx;
      const z = b.center[2] + Math.sin(a) * b.rz;
      g.position.set(x, b.center[1] + Math.sin(a * 3) * b.bob, z);
      // Face along the direction of travel.
      g.rotation.y = Math.atan2(-Math.sin(a) * b.rx, Math.cos(a) * b.rz);
      const flap = Math.sin(t * 9 + i) * 0.85;
      (g.children[1] as Mesh).rotation.z = flap;
      (g.children[2] as Mesh).rotation.z = -flap;
    });
  });
  return (
    <>
      {BATS.map((_, i) => (
        <group key={i} ref={(g) => void (bats.current[i] = g)} scale={1.6}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.14, 0.4, 4, 8]} />
            <meshBasicMaterial color="#070b09" />
          </mesh>
          <mesh geometry={wing}>
            <meshBasicMaterial color="#070b09" side={DoubleSide} />
          </mesh>
          <mesh geometry={wing} scale={[-1, 1, 1]}>
            <meshBasicMaterial color="#070b09" side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}
