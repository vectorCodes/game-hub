import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type IUniform,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { journey } from "../journey";
import { isOpen, LAMPS, MOON, pathX, seeded } from "./layout";

/** Shared clock for every wind shader; frozen when the visitor prefers reduced motion. */
export const windTime: IUniform<number> = { value: 0 };
export function WindClock() {
  useFrame((_, delta) => {
    if (!journey.still) windTime.value += Math.min(delta, 0.1);
  });
  return null;
}

/** A dome from deep forest night overhead to a faint warm glow on the horizon. */
export function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color("#e7d9be") },
          uHorizon: { value: new Color("#f6eedf") },
          uGlow: { value: new Color("#2a1408") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
            // Warm haze low on the horizon, towards the sun.
            col += uGlow * pow(1.0 - h, 6.0) * smoothstep(-0.2, 0.8, -vDir.z);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, "rgba(217,88,44,0.35)");
  r.addColorStop(0.3, "rgba(217,88,44,0.12)");
  r.addColorStop(1, "rgba(217,88,44,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** The red sun where the moon used to hang: a flat disc, as on a print, with a faint haze. */
export function Moon() {
  const glow = useMemo(glowTexture, []);
  return (
    <group position={MOON}>
      <mesh>
        <sphereGeometry args={[6, 48, 48]} />
        <meshBasicMaterial color="#d9582c" toneMapped={false} fog={false} />
      </mesh>
      <sprite scale={[40, 40, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  );
}

/** Far ridges, as flat ink-wash silhouettes fading into the haze. */
export function Mountains() {
  const peaks = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 14 }, (_, i) => ({
      x: -120 + i * 18 + rand() * 10,
      z: -170 - rand() * 30,
      h: 26 + rand() * 30,
      r: 22 + rand() * 18,
    }));
  }, []);
  return (
    <group>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2 - 2, p.z]}>
          <coneGeometry args={[p.r, p.h, 5]} />
          <meshBasicMaterial color="#a39a84" />
        </mesh>
      ))}
    </group>
  );
}

export function Ground() {
  const path = useMemo(() => {
    const g = new PlaneGeometry(2.2, 120, 1, 120);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) - 40;
      pos.setZ(i, z);
      pos.setX(i, pos.getX(i) + pathX(z));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -60]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#dccaa6" roughness={1} />
      </mesh>
      <mesh geometry={path} position={[0, 0.01, 0]} receiveShadow>
        <meshStandardMaterial color="#c3a979" roughness={1} />
      </mesh>
    </group>
  );
}

/** Tens of thousands of blades swaying in the wind, warmed where the lamps fall. */
export function Grass({ count, density = 1 }: { count: number; density?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const placedCount = useRef(0);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(0.09, 0.62, 1, 4);
    g.translate(0, 0.31, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (1 - pos.getY(i) / 0.62));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: DoubleSide,
        fog: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uBase: { value: new Color("#9a9468") },
            uTip: { value: new Color("#e2cf98") },
            uWarm: { value: new Color("#3a2a10") },
            uLamps: { value: LAMPS.map((l) => new Vector3(...l)) },
          },
        ]),
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying float vH;
          varying vec3 vWorld;
          #include <fog_pars_vertex>
          void main() {
            float h = clamp(position.y / 0.62, 0.0, 1.0);
            vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
            float wind = sin(uTime * 1.5 + world.x * 0.35 + world.z * 0.22) * 0.6
                       + sin(uTime * 2.6 + world.x * 0.9 - world.z * 0.4) * 0.25;
            world.x += wind * h * h * 0.2;
            world.z += wind * h * h * 0.08;
            vH = h;
            vWorld = world.xyz;
            vec4 mvPosition = viewMatrix * world;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uWarm; uniform vec3 uLamps[4];
          varying float vH;
          varying vec3 vWorld;
          #include <fog_pars_fragment>
          void main() {
            vec3 col = mix(uBase, uTip, vH * vH);
            float glow = 0.0;
            for (int i = 0; i < 4; i++) glow += smoothstep(8.0, 0.0, distance(vWorld.xz, uLamps[i].xz));
            col += uWarm * glow * (0.12 + vH * 0.45);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      }),
    [],
  );
  material.uniforms.uTime = windTime;

  useLayoutEffect(() => {
    const rand = seeded(42);
    const dummy = new Object3D();
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 4; tries++) {
      const x = -24 + rand() * 48;
      const z = -82 + rand() * 106;
      if (Math.abs(x - pathX(z)) < 0.9) continue;
      if (Math.abs(x) < 4.8 && z < -22.8 && z > -25.4) continue; // under the wall
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rand() * Math.PI, (rand() - 0.5) * 0.25);
      const s = 0.6 + rand() * 0.9;
      dummy.scale.set(s, s * (0.8 + rand() * 0.7), s);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(placed++, dummy.matrix);
    }
    placedCount.current = placed;
    mesh.current!.count = placed;
    mesh.current!.instanceMatrix.needsUpdate = true;
  }, [count]);

  // Placement order is random, so drawing the first N keeps an even spread.
  useLayoutEffect(() => {
    mesh.current!.count = Math.floor(placedCount.current * density);
  }, [density, count]);

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}

/** Low-poly pines and bushes that lean gently in the wind. */
export function Forest({ count, density = 1 }: { count: number; density?: number }) {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const placedCount = useRef(0);

  const { crownGeometry, trunkGeometry, crownMaterial, trunkMaterial } = useMemo(() => {
    const tiers = [0, 1, 2].map((i) => {
      const c = new ConeGeometry(1.5 - i * 0.38, 1.9 - i * 0.2, 7);
      c.translate(0, 1.9 + i * 1.05, 0);
      return c;
    });
    const crownGeometry = mergeGeometries(tiers)!;
    const trunkGeometry = new CylinderGeometry(0.12, 0.2, 1.8, 6);
    trunkGeometry.translate(0, 0.9, 0);

    const crownMaterial = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, flatShading: true });
    // Sway the crowns from the base up, per tree.
    crownMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float seed = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
           float sway = sin(uTime * 0.9 + seed) * 0.05 + sin(uTime * 1.7 + seed * 2.0) * 0.02;
           transformed.x += sway * max(transformed.y - 1.0, 0.0);`,
        );
    };
    const trunkMaterial = new MeshStandardMaterial({ color: "#5a4a38", roughness: 1 });
    return { crownGeometry, trunkGeometry, crownMaterial, trunkMaterial };
  }, []);

  useLayoutEffect(() => {
    const rand = seeded(11);
    const dummy = new Object3D();
    const shades = ["#5f7d6c", "#6c8875", "#55705f", "#7a937d", "#4e6a5b"].map((c) => new Color(c));
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 6; tries++) {
      const x = -48 + rand() * 96;
      const z = -135 + rand() * 160;
      if (isOpen(x, z, 2.6)) continue;
      const s = 0.85 + rand() * 1.1;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.9 + rand() * 0.5), s);
      dummy.updateMatrix();
      trunks.current!.setMatrixAt(placed, dummy.matrix);
      crowns.current!.setMatrixAt(placed, dummy.matrix);
      crowns.current!.setColorAt(placed, shades[Math.floor(rand() * shades.length)]);
      placed++;
    }
    placedCount.current = placed;
    for (const m of [trunks.current!, crowns.current!]) {
      m.count = placed;
      m.instanceMatrix.needsUpdate = true;
    }
    crowns.current!.instanceColor!.needsUpdate = true;
  }, [count]);

  // Thin the forest from the far end of the list (placement order is random).
  useLayoutEffect(() => {
    const n = Math.floor(placedCount.current * (0.4 + 0.6 * density));
    trunks.current!.count = n;
    crowns.current!.count = n;
  }, [density, count]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[trunkGeometry, trunkMaterial, count]} frustumCulled={false} />
      <instancedMesh ref={crowns} args={[crownGeometry, crownMaterial, count]} frustumCulled={false} />
    </group>
  );
}

/** Round, mossy rocks scattered along the path edge. */
export function Rocks() {
  const rocks = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: 26 }, () => {
      const z = 14 - rand() * 90;
      const side = rand() > 0.5 ? 1 : -1;
      return { x: pathX(z) + side * (1.4 + rand() * 2.2), z, s: 0.25 + rand() * 0.45, r: rand() * 3 };
    });
  }, []);
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), []);
  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={i} geometry={geometry} position={[r.x, r.s * 0.4, r.z]} scale={[r.s * 1.3, r.s, r.s]} rotation={[0, r.r, 0]}>
          <meshStandardMaterial color="#aaa08a" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
