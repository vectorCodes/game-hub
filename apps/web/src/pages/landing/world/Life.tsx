import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  BufferGeometry,
  Color,
  DoubleSide,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  type Group,
  type Mesh,
} from "three";
import { windTime } from "./Nature";
import { LAMPS, seeded, type V3 } from "./layout";
import { useQuality } from "./quality";

const LANTERN_GLOW: [number, number, number] = [4.2, 2.7, 1.1];

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
        <meshStandardMaterial color="#1a1f1b" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[x, 0.15, z]}>
        <cylinderGeometry args={[0.22, 0.28, 0.3, 8]} />
        <meshStandardMaterial color="#1a1f1b" roughness={0.6} metalness={0.4} />
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
            <meshStandardMaterial color="#1a1f1b" roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.32, 0.04, 0.32]} />
          <meshStandardMaterial color="#1a1f1b" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.26, 0.2, 4]} />
          <meshStandardMaterial color="#1a1f1b" roughness={0.6} metalness={0.4} />
        </mesh>
        {light && !weak && <pointLight color="#ffc978" intensity={18} distance={16} decay={1.6} />}
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

/** Moths drawn to the clearing's lamp, fluttering on loose orbits. */
export function Moths({ around, count = 7 }: { around: V3; count?: number }) {
  const moths = useRef<(Group | null)[]>([]);
  const wing = useMemo(() => new PlaneGeometry(0.1, 0.07).translate(0.05, 0, 0).rotateX(-Math.PI / 2), []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ r: 0.5 + (i % 3) * 0.25, s: 1.4 + i * 0.37, p: i * 1.3 })), [count]);
  useFrame(() => {
    const t = windTime.value;
    seeds.forEach((m, i) => {
      const g = moths.current[i];
      if (!g) return;
      const a = t * m.s + m.p;
      g.position.set(
        around[0] + Math.cos(a) * m.r + Math.sin(a * 2.3) * 0.12,
        around[1] + Math.sin(a * 1.7) * 0.35,
        around[2] + Math.sin(a) * m.r,
      );
      g.rotation.y = -a;
      const flap = Math.sin(t * 38 + m.p) * 0.9;
      (g.children[0] as Mesh).rotation.z = flap;
      (g.children[1] as Mesh).rotation.z = -flap;
    });
  });
  return (
    <>
      {seeds.map((_, i) => (
        <group key={i} ref={(g) => void (moths.current[i] = g)} scale={0.9}>
          {[1, -1].map((side) => (
            <mesh key={side} geometry={wing} scale={[side, 1, 1]}>
              <meshStandardMaterial color="#f6ead0" emissive="#f4b94e" emissiveIntensity={0.6} side={DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** A bat silhouette: scalloped wings that flap, crossing the moonlit sky on long loops. */
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

/** Fireflies: soft additive points that drift, bob and pulse. */
function FireflySwarm({ count, center, spread, color, size }: { count: number; center: V3; spread: V3; color: string; size: number }) {
  const { geometry, material } = useMemo(() => {
    const rand = seeded(count * 13 + Math.round(center[2]));
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = center[0] + (rand() - 0.5) * spread[0];
      pos[i * 3 + 1] = center[1] + (rand() - 0.5) * spread[1];
      pos[i * 3 + 2] = center[2] + (rand() - 0.5) * spread[2];
      seed[i] = rand() * 100;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: windTime, uColor: { value: new Color(color) }, uSize: { value: size } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uSize;
        attribute float aSeed;
        varying float vPulse;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.5 + aSeed) * 0.8;
          p.y += sin(uTime * 0.8 + aSeed * 1.7) * 0.5;
          p.z += cos(uTime * 0.4 + aSeed * 0.6) * 0.8;
          vPulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.2 + aSeed * 3.0), 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (0.6 + vPulse) * (20.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vPulse;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float glow = smoothstep(0.5, 0.0, d);
          glow = glow * glow * 1.6 + smoothstep(0.12, 0.0, d);
          gl_FragColor = vec4(uColor * glow * vPulse, 1.0);
        }`,
    });
    return { geometry, material };
  }, [count, center, spread, color, size]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

const SWARMS: { center: V3; spread: V3; color: string; size: number; count: number }[] = [
  { center: [0, 2.6, -40], spread: [44, 5, 120], color: "#f8e08a", size: 9, count: 200 },
  { center: [0, 2.6, 2], spread: [12, 4, 12], color: "#ffd27a", size: 11, count: 50 },
  { center: [0, 2.6, -60], spread: [18, 5, 18], color: "#c9f29a", size: 11, count: 70 },
];

export function Fireflies({ dense }: { dense: boolean }) {
  return (
    <>
      {SWARMS.map((s, i) => (
        <FireflySwarm key={i} {...s} count={dense ? s.count : Math.round(s.count * 0.4)} />
      ))}
    </>
  );
}
