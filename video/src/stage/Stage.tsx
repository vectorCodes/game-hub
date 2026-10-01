import { useMemo, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { ThreeCanvas } from "@remotion/three";
import { Easing, interpolate, useVideoConfig } from "remotion";
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
  type Mesh,
  type PerspectiveCamera,
} from "three";
import { colors, glide } from "../theme";
import { MODELS, type ModelName } from "./models";

export type Vec3 = [number, number, number];

/** Same convention as the game: the direction the light comes from, in degrees. */
export type LightAngle = { azimuth: number; elevation: number };

export const WALL_Z = -4.5;
export const FLOOR_Y = -6;
/** Every object is scaled so its largest dimension is this long (as in the game). */
const TARGET_SIZE = 4.2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function angleToQuaternion({ azimuth, elevation }: LightAngle): Quaternion {
  return new Quaternion().setFromEuler(
    new Euler(MathUtils.degToRad(elevation), MathUtils.degToRad(azimuth), 0, "XYZ"),
  );
}

/** Blends between two light angles along the shortest rotation, like the game's slerp. */
export function slerpAngle(from: LightAngle, to: LightAngle, t: number): Quaternion {
  return angleToQuaternion(from).slerp(angleToQuaternion(to), MathUtils.clamp(t, 0, 1));
}

/** Moves a point from `from` to `to` over `[start, end]` frames with a smooth in-out. */
export function track(frame: number, [start, end]: [number, number], from: Vec3, to: Vec3): Vec3 {
  return from.map((v, i) =>
    interpolate(frame, [start, end], [v, to[i]], { ...clamp, easing: Easing.bezier(...glide) }),
  ) as Vec3;
}

/** Chains several `track()` legs: keys are [frame, value] pairs, held between legs. */
export function keyframes(frame: number, keys: [number, Vec3][]): Vec3 {
  let value = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (frame >= keys[i - 1][0]) value = track(frame, [keys[i - 1][0], keys[i][0]], keys[i - 1][1], keys[i][1]);
  }
  return value;
}

/** A point on a sphere around `center`; azimuth 0 is straight in front of the wall (+z). */
export function orbit(center: Vec3, radius: number, azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = MathUtils.degToRad(azimuthDeg);
  const el = MathUtils.degToRad(elevationDeg);
  return [
    center[0] + radius * Math.cos(el) * Math.sin(az),
    center[1] + radius * Math.sin(el),
    center[2] + radius * Math.cos(el) * Math.cos(az),
  ];
}

/** A canvas with soft shadows on a near-black background. Defaults to the full frame. */
export function StageCanvas({ children, width, height }: { children: ReactNode; width?: number; height?: number }) {
  const video = useVideoConfig();
  return (
    <ThreeCanvas
      width={width ?? video.width}
      height={height ?? video.height}
      shadows
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[colors.night]} />
      {children}
    </ThreeCanvas>
  );
}

/**
 * Places the camera for the current frame. Values are computed by the caller from
 * `useCurrentFrame()`; this only applies them, so every frame is deterministic.
 */
export function CameraRig({
  position,
  target = [0, 0, 0],
  fov = 32,
  roll = 0,
}: {
  position: Vec3;
  target?: Vec3;
  fov?: number;
  roll?: number;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  camera.position.set(...position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...target);
  camera.rotateZ(MathUtils.degToRad(roll));
  camera.fov = fov;
  camera.near = 0.1;
  camera.far = 150;
  camera.updateProjectionMatrix();
  return null;
}

/** Floor that sweeps up into the wall with no visible seam, like a photo studio. */
function useCycGeometry(width: number, depth: number, height: number, radius: number) {
  return useMemo(() => {
    const profile: [number, number][] = []; // [y, z]
    profile.push([FLOOR_Y, WALL_Z + depth]);
    const arc = 24;
    for (let i = 0; i <= arc; i++) {
      const t = (i / arc) * (Math.PI / 2);
      profile.push([FLOOR_Y + radius - radius * Math.cos(t), WALL_Z + radius - radius * Math.sin(t)]);
    }
    profile.push([FLOOR_Y + height, WALL_Z]);

    const positions: number[] = [];
    const indices: number[] = [];
    for (const [y, z] of profile) positions.push(-width / 2, y, z, width / 2, y, z);
    for (let r = 0; r < profile.length - 1; r++) {
      const a = r * 2;
      const b = a + 2;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [width, depth, height, radius]);
}

export function Cyclorama() {
  const geometry = useCycGeometry(70, 40, 24, 3);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={colors.cyc} roughness={0.95} side={DoubleSide} />
    </mesh>
  );
}

/** Low violet fill so shadows read as deep ink rather than pure black. */
export function Fill({ intensity = 1 }: { intensity?: number }) {
  return <hemisphereLight args={["#8fa882", "#16201b", 0.22 * intensity]} />;
}

/**
 * The key light: one soft-edged spotlight that throws the shadow and a pool of light
 * on the backdrop, falling off into darkness.
 */
export function KeyLight({
  position = [0, 0.4, 11],
  target = [0, 0, WALL_Z],
  intensity = 1,
  angle = 0.34,
  penumbra = 1,
}: {
  position?: Vec3;
  target?: Vec3;
  /** 0 = off, 1 = full. */
  intensity?: number;
  angle?: number;
  penumbra?: number;
}) {
  const aim = useMemo(() => new Object3D(), []);
  return (
    <>
      <primitive object={aim} position={target} />
      <spotLight
        position={position}
        target={aim}
        color="#fff0d4"
        intensity={3.4 * intensity}
        angle={angle}
        penumbra={penumbra}
        decay={0}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </>
  );
}

/**
 * A model from the game's catalog, drawn as three layers so each can fade on its own:
 * a shadow caster that is invisible to the camera (as in the game), a matte clay
 * version, and the original colours.
 */
export function ShadowObject({
  model,
  angle,
  quaternion,
  position = [0, 0, 0],
  size = TARGET_SIZE,
  clay = 0,
  reveal = 0,
  grounded = false,
}: {
  model: ModelName;
  angle?: LightAngle;
  /** Overrides `angle`, e.g. from `slerpAngle()`. */
  quaternion?: Quaternion;
  position?: Vec3;
  size?: number;
  /** Opacity of the clay version. */
  clay?: number;
  /** Opacity of the full-colour version (replaces the clay). */
  reveal?: number;
  /** Rest the model on y = 0 instead of centering it. */
  grounded?: boolean;
}) {
  const { scene } = useGLTF(MODELS[model]);

  const layers = useMemo(() => {
    const normalize = (root: Object3D) => {
      root.updateMatrixWorld(true);
      const box = new Box3().setFromObject(root);
      const s = size / Math.max(...box.getSize(new Vector3()).toArray());
      root.scale.setScalar(s);
      root.position.copy(box.getCenter(new Vector3()).multiplyScalar(-s));
      if (grounded) root.position.y = -box.min.y * s;
      return root;
    };
    const meshes = (root: Object3D) => {
      const list: Mesh[] = [];
      root.traverse((o) => {
        if ((o as Mesh).isMesh) list.push(o as Mesh);
      });
      return list;
    };

    // colorWrite/depthWrite off: invisible to the camera, but still in the shadow map.
    const hidden = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const caster = normalize(scene.clone(true));
    for (const m of meshes(caster)) {
      m.material = hidden;
      m.castShadow = true;
    }

    const clayMaterial = new MeshStandardMaterial({ color: "#efe6d2", roughness: 0.8, transparent: true });
    const clayModel = normalize(scene.clone(true));
    for (const m of meshes(clayModel)) {
      m.material = clayMaterial;
      m.castShadow = false;
      m.receiveShadow = true;
    }

    const colorMaterials: Material[] = [];
    const colorModel = normalize(scene.clone(true));
    for (const m of meshes(colorModel)) {
      const clone = (mat: Material) => {
        const c = mat.clone();
        c.transparent = true;
        colorMaterials.push(c);
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(clone) : clone(m.material);
      m.castShadow = false;
      m.receiveShadow = true;
    }
    return { caster, clayModel, clayMaterial, colorModel, colorMaterials };
  }, [scene, size, grounded]);

  // Apply this frame's opacities (deterministic, no useFrame).
  layers.clayMaterial.opacity = clay * (1 - reveal);
  // Always write depth, so a half-faded model shows only its front faces.
  layers.clayMaterial.depthWrite = true;
  for (const m of layers.colorMaterials) {
    m.opacity = reveal;
    m.depthWrite = true;
  }

  const q = quaternion ?? angleToQuaternion(angle ?? { azimuth: 0, elevation: 0 });
  return (
    <group position={position} quaternion={q}>
      <primitive object={layers.caster} />
      {clay > 0 && reveal < 1 && <primitive object={layers.clayModel} />}
      {reveal > 0 && <primitive object={layers.colorModel} />}
    </group>
  );
}

/**
 * Even, parallel light across a long stretch of wall (for line-ups of several objects),
 * like the game's own directional light.
 */
export function SunLight({ intensity = 1, halfWidth = 26 }: { intensity?: number; halfWidth?: number }) {
  return (
    <directionalLight
      position={[0, 1.5, 12]}
      color="#fff4e0"
      intensity={2.4 * intensity}
      castShadow
      shadow-mapSize={[4096, 2048]}
      shadow-bias={-0.0003}
      shadow-normalBias={0.02}
    >
      <orthographicCamera attach="shadow-camera" args={[-halfWidth, halfWidth, 8, -8, 0.5, 40]} />
    </directionalLight>
  );
}
