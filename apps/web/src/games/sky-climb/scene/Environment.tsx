// Sky, light and weather. All of it follows the climber's height: a bright morning in the
// meadow, golden hour on the cliffs, sunset on the snow, a storm, then a starry summit.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type LineSegments,
  type Points,
  IcosahedronGeometry,
  Matrix4,
  Vector3,
  type PointsMaterial,
  type LineBasicMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { zoneOf } from "../config";
import { makeRng, type Tower } from "../tower";
import { lookAt, newLook, useKit, useSim } from "./shared";

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
  uniform float flash;
  varying float vHeight;
  void main() {
    float t = smoothstep(-0.25, 0.75, vHeight);
    vec3 color = mix(bottom, top, t) + flash * vec3(0.55, 0.6, 0.8);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Lightning in the storm: 0 most of the time, a sharp flash now and then. */
const storm = { flash: 0, next: 4 };

/** The sky dome, sun, ambient light and fog, all blended for the climber's height. */
const SHADOW_BOX = 12;
const SUN_OFFSET = new Vector3(9, 16, 6);
/** The sun's shadow camera axes (it looks along -SUN_OFFSET with +y up). */
const SUN_Z = SUN_OFFSET.clone().normalize();
const SUN_X = new Vector3(0, 1, 0).cross(SUN_Z).normalize();
const SUN_Y = SUN_Z.clone().cross(SUN_X);
const snapped = new Vector3();

export function SkyAndLight({ shadowMap }: { shadowMap: number }) {
  const sim = useSim();
  const camera = useThree((s) => s.camera);
  const dome = useRef<Group>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const look = useMemo(newLook, []);
  const uniforms = useMemo(() => ({ top: { value: new Color() }, bottom: { value: new Color() }, flash: { value: 0 } }), []);
  const fog = useMemo(() => new Fog("#cde9fb", 22, 85), []);

  // A new map size needs a new shadow map.
  useEffect(() => {
    const shadow = sun.current?.shadow;
    if (!shadow?.map) return;
    shadow.map.dispose();
    shadow.map = null;
  }, [shadowMap]);

  useFrame((_, dt) => {
    const pl = sim.player;
    lookAt(pl.height, look);

    // Lightning only in the storm.
    if (zoneOf(Math.floor(pl.height)).id === "storm") {
      storm.next -= dt;
      if (storm.next <= 0) {
        storm.flash = 1;
        storm.next = 5 + Math.random() * 7;
      }
    }
    storm.flash = Math.max(0, storm.flash - dt * 3.5);
    const flash = storm.flash * (0.6 + 0.4 * Math.sin(storm.flash * 40));

    uniforms.top.value.copy(look.top as Color);
    uniforms.bottom.value.copy(look.bottom as Color);
    uniforms.flash.value = flash;
    fog.color.copy(look.fog as Color);
    dome.current?.position.copy(camera.position);

    if (hemi.current) {
      hemi.current.color.copy(look.hemiSky as Color);
      hemi.current.groundColor.copy(look.hemiGround as Color);
      hemi.current.intensity = (look.hemiIntensity as number) + flash * 2;
    }
    if (sun.current) {
      // The sun's shadow box follows the climber, moved in whole shadow-map texels so
      // shadow edges stay put instead of shimmering as you walk.
      sun.current.color.copy(look.sun as Color);
      sun.current.intensity = look.sunIntensity as number;
      const texel = (SHADOW_BOX * 2) / shadowMap;
      snapped.set(pl.x, pl.y, pl.z);
      const a = snapped.dot(SUN_X);
      const b = snapped.dot(SUN_Y);
      snapped.addScaledVector(SUN_X, Math.round(a / texel) * texel - a).addScaledVector(SUN_Y, Math.round(b / texel) * texel - b);
      sun.current.position.copy(snapped).add(SUN_OFFSET);
      sun.current.target.position.copy(snapped);
      sun.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <primitive attach="fog" object={fog} />
      <group ref={dome}>
        <mesh renderOrder={-1}>
          <sphereGeometry args={[300, 32, 16]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={SKY_VERTEX}
            fragmentShader={SKY_FRAGMENT}
            side={BackSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={shadowMap}
        shadow-radius={2.5}
        shadow-camera-left={-SHADOW_BOX}
        shadow-camera-right={SHADOW_BOX}
        shadow-camera-top={SHADOW_BOX}
        shadow-camera-bottom={-SHADOW_BOX}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  );
}

/** Stars fade in once the sky gets dark, high up. */
export function Stars() {
  const sim = useSim();
  const camera = useThree((s) => s.camera);
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const rng = makeRng("stars");
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Upper hemisphere, spread evenly.
      const u = rng() * 2 * Math.PI;
      const v = rng() * 0.9 + 0.05;
      const r = 250;
      pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r;
      pos[i * 3 + 1] = v * r;
      pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(() => {
    const p = points.current;
    if (!p) return;
    p.position.copy(camera.position);
    const night = Math.min(1, Math.max(0, (sim.player.height - 60) / 25));
    (p.material as PointsMaterial).opacity = night;
    p.visible = night > 0.01;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={1.6} sizeAttenuation={false} color="#ffffff" transparent depthWrite={false} fog={false} />
    </points>
  );
}

const WEATHER_COUNT = 420;
const BOX = { x: 34, y: 22, z: 34 };

/**
 * Particles around the camera: petals in the meadow, leaves in the treetops, golden dust on
 * the cliffs, snow on the peak, rain in the storm.
 */
export function Weather({ weak }: { weak: boolean }) {
  const sim = useSim();
  const camera = useThree((s) => s.camera);
  const motes = useRef<Points>(null);
  const rain = useRef<LineSegments>(null);
  const count = weak ? WEATHER_COUNT / 2 : WEATHER_COUNT;

  const { moteGeometry, rainGeometry, seeds } = useMemo(() => {
    const rng = makeRng("weather");
    const seeds = new Float32Array(count * 3);
    const mote = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = (rng() - 0.5) * BOX.x;
      seeds[i * 3 + 1] = (rng() - 0.5) * BOX.y;
      seeds[i * 3 + 2] = (rng() - 0.5) * BOX.z;
    }
    const moteGeometry = new BufferGeometry();
    moteGeometry.setAttribute("position", new BufferAttribute(mote, 3));
    const rainGeometry = new BufferGeometry();
    rainGeometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 6), 3));
    return { moteGeometry, rainGeometry, seeds };
  }, [count]);

  useFrame((_, dt) => {
    const zone = zoneOf(Math.floor(sim.player.height));
    const kind = zone.weather;
    const c = camera.position;
    const t = sim.t;
    const fall = kind === "snow" ? 1.6 : kind === "rain" ? 22 : kind === "dust" ? -0.15 : 0.7;
    const sway = kind === "dust" ? 0.4 : kind === "rain" ? 0 : 1.1;
    const windX = sim.gust * 7;

    for (let i = 0; i < count; i++) {
      seeds[i * 3 + 1] -= fall * dt * (0.7 + (i % 7) * 0.06);
      seeds[i * 3] += windX * dt;
      if (seeds[i * 3 + 1] < -BOX.y / 2) seeds[i * 3 + 1] += BOX.y;
      if (seeds[i * 3 + 1] > BOX.y / 2) seeds[i * 3 + 1] -= BOX.y;
      if (seeds[i * 3] > BOX.x / 2) seeds[i * 3] -= BOX.x;
    }

    const showRain = kind === "rain";
    const showMotes = kind !== "rain" && kind !== "stars";
    if (motes.current) {
      motes.current.visible = showMotes;
      if (showMotes) {
        const pos = moteGeometry.attributes.position as BufferAttribute;
        for (let i = 0; i < count; i++) {
          const s = Math.sin(t * 0.8 + i) * sway;
          pos.setXYZ(i, c.x + seeds[i * 3] + s, c.y + seeds[i * 3 + 1], c.z + seeds[i * 3 + 2] + Math.cos(t * 0.6 + i) * sway * 0.5);
        }
        pos.needsUpdate = true;
        const m = motes.current.material as PointsMaterial;
        m.color.set(kind === "snow" ? "#ffffff" : kind === "petals" ? "#ffd1e3" : kind === "leaves" ? "#9ed36a" : "#ffd88a");
        m.size = kind === "snow" ? 0.16 : kind === "dust" ? 0.08 : 0.13;
      }
    }
    if (rain.current) {
      rain.current.visible = showRain;
      if (showRain) {
        const pos = rainGeometry.attributes.position as BufferAttribute;
        for (let i = 0; i < count; i++) {
          const x = c.x + seeds[i * 3];
          const y = c.y + seeds[i * 3 + 1];
          const z = c.z + seeds[i * 3 + 2];
          pos.setXYZ(i * 2, x, y, z);
          pos.setXYZ(i * 2 + 1, x - windX * 0.04, y - 0.7, z);
        }
        pos.needsUpdate = true;
        (rain.current.material as LineBasicMaterial).opacity = 0.35;
      }
    }
  });

  return (
    <>
      <points ref={motes} geometry={moteGeometry} frustumCulled={false}>
        <pointsMaterial size={0.13} transparent opacity={0.85} depthWrite={false} />
      </points>
      <lineSegments ref={rain} geometry={rainGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#b9c8ee" transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} />
      </lineSegments>
    </>
  );
}

/**
 * One cloud layer as a single mesh: each cloud is a few squashed low-poly spheres, all
 * merged so a whole layer costs one draw call.
 */
function cloudLayer(rng: () => number, y: number, count: number, minR: number, maxR: number, spread: number) {
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  for (let c = 0; c < count; c++) {
    const a = rng() * Math.PI * 2;
    const r = minR + rng() * (maxR - minR);
    const cx = Math.cos(a) * r;
    const cy = y + (rng() - 0.5) * spread;
    const cz = Math.sin(a) * r;
    const scale = 1.6 + rng() * 2.4;
    for (let i = 0; i < 5; i++) {
      const blob = new IcosahedronGeometry(0.8 + rng() * 0.7 - Math.abs(i - 2) * 0.15, 1);
      m.makeScale(scale, scale * 0.6, scale).setPosition(
        cx + ((i - 2) * 0.9 + (rng() - 0.5) * 0.5) * scale,
        cy + (rng() - 0.3) * 0.5 * scale * 0.6,
        cz + (rng() - 0.5) * 0.9 * scale,
      );
      parts.push(blob.applyMatrix4(m));
    }
  }
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Cloud layers to climb through: a sea of cloud under the island, white clouds around the
 * cliffs, dark storm clouds higher up. They turn slowly round the tower.
 */
export function Clouds({ tower }: { tower: Tower }) {
  const ring = useRef<Group>(null);
  const layers = useMemo(() => {
    const rng = makeRng(`clouds:${tower.seed}`);
    return [
      { geometry: cloudLayer(rng, -14, 26, 6, 40, 4), color: "#ffffff", opacity: 0.95 },
      { geometry: cloudLayer(rng, tower.floorTops[38], 22, 9, 34, 7), color: "#ffffff", opacity: 0.9 },
      { geometry: cloudLayer(rng, tower.floorTops[66], 24, 9, 36, 8), color: "#7f86a6", opacity: 0.92 },
      { geometry: cloudLayer(rng, tower.floorTops[96] + 3, 18, 10, 40, 5), color: "#5b6184", opacity: 0.85 },
    ];
  }, [tower]);

  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * 0.012;
  });

  return (
    <group ref={ring}>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geometry}>
          <meshStandardMaterial color={l.color} roughness={1} flatShading transparent opacity={l.opacity} />
        </mesh>
      ))}
    </group>
  );
}

/** The floating island the tower stands on, with a few trees around the start. */
export function Island() {
  const tree = useKit("tree");
  const pine = useKit("tree-pine");
  const flowers = useKit("flowers");
  const props = useMemo(() => {
    const rng = makeRng("island");
    const items: { object: typeof tree; x: number; z: number; s: number; yaw: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
      const r = 6.8 + rng() * 2;
      const object = i % 3 === 0 ? flowers.clone() : (i % 2 ? tree : pine).clone();
      items.push({ object, x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1.2 + rng() * 0.6, yaw: rng() * 6 });
    }
    return items;
  }, [tree, pine, flowers]);

  return (
    <group position={[0, -0.65, 0]}>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <cylinderGeometry args={[9.5, 9.5, 0.5, 40]} />
        <meshStandardMaterial color="#79c66b" roughness={0.95} />
      </mesh>
      <mesh position={[0, -4.2, 0]} receiveShadow>
        <cylinderGeometry args={[9.4, 2.2, 7.4, 14, 3]} />
        <meshStandardMaterial color="#b87149" roughness={1} flatShading />
      </mesh>
      {props.map((p, i) => (
        <primitive key={i} object={p.object} position={[p.x, 0, p.z]} scale={p.s} rotation-y={p.yaw} />
      ))}
    </group>
  );
}
