// The sky, the sun, and the floating island under the hole: grass on top, rock tapering away
// below, a few trees and flowers (from Sky Climb's kit), and clouds drifting past.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { BackSide, Color, Fog, IcosahedronGeometry, Matrix4, type DirectionalLight, type Group, type Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeRng } from "@shadow/shared";
import type { HoleLayout } from "../course";
import { ISLAND_DROP } from "./Course";
import { usePuttScene } from "./shared";

const SKY_VERTEX = /* glsl */ `
  varying float vHeight;
  void main() {
    vHeight = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 top;
  uniform vec3 bottom;
  varying float vHeight;
  void main() {
    gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.3, 0.6, vHeight)), 1.0);
  }
`;

const DECOR = ["tree", "tree-pine", "flowers", "flowers-tall", "plant", "rocks", "mushrooms", "grass"] as const;
const decorUrl = (p: string) => `/sky-climb/kit/${p}.glb`;
for (const p of DECOR) useGLTF.preload(decorUrl(p));

/** The hole's middle and how far it reaches from there. */
function extent(hole: HoleLayout) {
  const { minX, maxX, minZ, maxZ } = hole.bounds;
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, radius: Math.hypot(maxX - minX, maxZ - minZ) / 2 };
}

export function SkyAndLight() {
  const { hole } = usePuttScene();
  const camera = useThree((s) => s.camera);
  const dome = useRef<Group>(null);
  const sun = useRef<DirectionalLight>(null);
  const uniforms = useMemo(() => ({ top: { value: new Color("#3f8fe0") }, bottom: { value: new Color("#d6eefc") } }), []);
  const fog = useMemo(() => new Fog("#cfe8fa", 18, 60), []);
  const { cx, cz, radius } = extent(hole);

  // The sun's shadow box covers the whole hole.
  const box = radius + 1.5;
  useFrame(() => {
    dome.current?.position.copy(camera.position);
    const s = sun.current;
    if (!s) return;
    s.position.set(cx + 6, 12, cz + 4);
    s.target.position.set(cx, 0, cz);
    s.target.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={fog} attach="fog" />
      <group ref={dome}>
        <mesh scale={300} renderOrder={-1}>
          <sphereGeometry args={[1, 32, 16]} />
          <shaderMaterial vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={uniforms} side={BackSide} depthWrite={false} fog={false} />
        </mesh>
      </group>
      <hemisphereLight args={["#dff1ff", "#5d7a46", 1.1]} />
      <directionalLight
        ref={sun}
        intensity={2.3}
        color="#fff2dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-box}
        shadow-camera-right={box}
        shadow-camera-top={box}
        shadow-camera-bottom={-box}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
    </>
  );
}

export function Island() {
  const { hole } = usePuttScene();
  const { cx, cz, radius } = extent(hole);
  const r = radius + 1.2;
  const top = -ISLAND_DROP;
  return (
    <group position={[cx, top, cz]}>
      <mesh receiveShadow position-y={-0.08}>
        <cylinderGeometry args={[r, r * 0.97, 0.16, 9]} />
        <meshStandardMaterial color="#79c66b" roughness={0.95} flatShading />
      </mesh>
      <mesh position-y={-0.16 - r * 0.55} castShadow>
        <cylinderGeometry args={[r * 0.97, r * 0.12, r * 1.1, 9]} />
        <meshStandardMaterial color="#9b6b4a" roughness={1} flatShading />
      </mesh>
      <Decor hole={hole} radius={r} />
    </group>
  );
}

/** Trees and flowers scattered over the grass, clear of the course. */
function Decor({ hole, radius }: { hole: HoleLayout; radius: number }) {
  const gltfs = useGLTF(DECOR.map(decorUrl));
  const items = useMemo(() => {
    const rng = makeRng(`decor-${hole.id}`);
    const { cx, cz } = extent(hole);
    const placed: Object3D[] = [];
    // Behind the tee is where the camera starts: keep it clear.
    const backX = hole.tee.x - Math.sin(hole.teeYaw) * 1.6;
    const backZ = hole.tee.z - Math.cos(hole.teeYaw) * 1.6;
    for (let tries = 0; tries < 160 && placed.length < 14; tries++) {
      const kind = Math.floor(rng() * DECOR.length);
      const big = kind < 2;
      // Trees only round the rim, where the camera rarely goes; flowers anywhere.
      const a = rng() * Math.PI * 2;
      const d = big ? radius - 0.5 - rng() * 0.6 : Math.sqrt(rng()) * (radius - 0.4);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const clear = big ? 1.4 : 0.85;
      if (hole.tiles.some((t) => Math.abs(t.x - x) < clear && Math.abs(t.z - z) < clear)) continue;
      if (Math.hypot(x - backX, z - backZ) < (big ? 2.4 : 1)) continue;
      const o = gltfs[kind].scene.clone(true);
      o.position.set(x - cx, 0, z - cz);
      o.rotation.y = rng() * Math.PI * 2;
      o.scale.setScalar(big ? 0.9 + rng() * 0.5 : 0.7 + rng() * 0.4);
      o.traverse((m) => {
        if ((m as Mesh).isMesh) (m as Mesh).castShadow = true;
      });
      placed.push(o);
    }
    return placed;
  }, [gltfs, hole, radius]);
  return (
    <>
      {items.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

/** Puffy clouds drifting slowly past, mostly below the island. */
export function Clouds() {
  const { hole } = usePuttScene();
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    const rng = makeRng("putt-clouds");
    const parts = [];
    for (let c = 0; c < 9; c++) {
      const a = (c / 9) * Math.PI * 2 + rng();
      const d = 9 + rng() * 10;
      const y = -4 - rng() * 5 + (c % 3 === 0 ? 7 : 0);
      for (let k = 0; k < 4; k++) {
        const g = new IcosahedronGeometry(0.9 + rng() * 0.9, 1);
        g.applyMatrix4(new Matrix4().makeTranslation(Math.cos(a) * d + (k - 1.5) * 1.1, y + rng() * 0.5, Math.sin(a) * d + rng()));
        parts.push(g);
      }
    }
    return mergeGeometries(parts);
  }, []);
  const { cx, cz } = extent(hole);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.01;
  });
  return (
    <group ref={group} position={[cx, 0, cz]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading transparent opacity={0.92} />
      </mesh>
    </group>
  );
}
