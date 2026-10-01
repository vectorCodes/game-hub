import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, useGLTF } from "@react-three/drei";
import {
  Box3,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Group,
  type Material,
  type Mesh,
} from "three";
import { DEFAULT_ANGLES } from "@shadow/shared";
import { angleToQuaternion } from "../../../games/shadow-guess/scene/angles";
import { GLADE_MODELS, landingModel, WALL_MODEL } from "../assets";
import { journey } from "../journey";
import { LampPost } from "./Life";
import { GLADE, HIDDEN_OBJECT, WALL, WALL_LANTERN, type V3 } from "./layout";
import { useQuality } from "./quality";

const model = landingModel;
for (const m of [WALL_MODEL, ...GLADE_MODELS]) useGLTF.preload(model(m));

const clamp01 = (x: number) => MathUtils.clamp(x, 0, 1);
const smooth = (a: number, b: number, x: number) => MathUtils.smoothstep(x, a, b);

/** Clones a catalog model, centred and scaled so its largest side is `size`. */
function useModel(name: string, size: number) {
  const { scene } = useGLTF(model(name));
  return useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const s = size / Math.max(...box.getSize(new Vector3()).toArray());
    root.scale.setScalar(s);
    root.position.copy(box.getCenter(new Vector3()).multiplyScalar(-s));
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    return { root, meshes };
  }, [scene, size]);
}

/**
 * The game in miniature: a hidden object between a lantern and a wall. Scrolling turns it
 * through the game's six angles; then it's revealed, first as clay, then in full colour.
 */
export function ShadowWall() {
  const { weak } = useQuality();
  const pivot = useRef<Group>(null);
  const caster = useModel(WALL_MODEL, 2.3);
  const shown = useModel(WALL_MODEL, 2.3);

  const { clay, colors } = useMemo(() => {
    // Invisible to the camera but still in the shadow map, exactly like the game.
    const hidden = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const m of caster.meshes) {
      m.material = hidden;
      m.castShadow = true;
    }
    const clay = new MeshStandardMaterial({ color: "#efe6d2", roughness: 0.8, transparent: true, opacity: 0 });
    const colors: { mesh: Mesh; material: Material }[] = [];
    for (const m of shown.meshes) {
      const c = (m.material as Material).clone();
      c.transparent = true;
      colors.push({ mesh: m, material: c });
      m.castShadow = false;
    }
    return { clay, colors };
  }, [caster, shown]);

  const aim = useMemo(() => {
    const o = new Object3D();
    o.position.set(WALL.center[0], WALL.center[1], WALL.center[2]);
    return o;
  }, []);

  const angles = useMemo(() => DEFAULT_ANGLES.map(angleToQuaternion), []);
  const q = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const c = journey.chapter;
    // Chapters 0.6 → 1.9: the light turns through all six angles, hardest to clearest.
    const step = clamp01((c - 0.6) / 1.3) * (angles.length - 1);
    const i = Math.min(angles.length - 2, Math.floor(step));
    q.copy(angles[i]).slerp(angles[i + 1], smooth(0.15, 0.85, step - i));
    pivot.current!.quaternion.copy(q);

    // Behind the scenes (chapter 2): clay fades in, then full colour.
    const clayOpacity = smooth(1.45, 1.75, c);
    const colorOpacity = smooth(1.75, 2.0, c);
    clay.opacity = clayOpacity * (1 - colorOpacity);
    for (const { mesh, material } of colors) {
      mesh.material = colorOpacity > 0 ? material : clay;
      material.opacity = colorOpacity;
    }
    shown.root.visible = clayOpacity > 0.01;
  });

  const [wx, wy, wz] = WALL.center;
  return (
    <group>
      {/* Stone wall with a lit parchment face. */}
      <mesh position={[wx, wy, wz - 0.45]}>
        <boxGeometry args={[WALL.width + 0.8, WALL.height + 0.6, 0.8]} />
        <meshStandardMaterial color="#363d35" roughness={1} />
      </mesh>
      <mesh position={[wx, wy, wz]} receiveShadow>
        <planeGeometry args={[WALL.width, WALL.height]} />
        <meshStandardMaterial color="#e9dfc6" roughness={1} />
      </mesh>
      <mesh position={[wx, wy + WALL.height / 2 + 0.38, wz - 0.4]}>
        <boxGeometry args={[WALL.width + 1, 0.22, 1]} />
        <meshStandardMaterial color="#3f6234" roughness={1} />
      </mesh>

      {/* The lantern that throws the shadow. */}
      <LampPost lantern={[WALL_LANTERN[0] + 0.3, WALL_LANTERN[1] + 0.2, WALL_LANTERN[2]]} light={false} />
      <primitive object={aim} />
      <spotLight
        position={WALL_LANTERN}
        target={aim}
        color="#ffe2a8"
        intensity={160}
        distance={30}
        decay={1.4}
        angle={0.5}
        penumbra={0.55}
        castShadow
        shadow-mapSize={weak ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />

      <group ref={pivot} position={HIDDEN_OBJECT}>
        <primitive object={caster.root} />
        <primitive object={shown.root} />
      </group>
    </group>
  );
}

/** One catalog object floating above a glowing stone pedestal. */
function Exhibit({ name, position, spin }: { name: string; position: V3; spin: number }) {
  const { root, meshes } = useModel(name, 1.7);
  useMemo(() => meshes.forEach((m) => (m.castShadow = false)), [meshes]);
  const turn = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!journey.still) turn.current!.rotation.y += delta * spin;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.85, 1, 0.8, 10]} />
        <meshStandardMaterial color="#2f362f" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.035, 8, 48]} />
        <meshStandardMaterial color={[1.4, 2.4, 0.9]} emissive={[0.7, 1.4, 0.4]} toneMapped={false} />
      </mesh>
      <Float speed={journey.still ? 0 : 1.6} rotationIntensity={0.2} floatIntensity={0.6} floatingRange={[0.1, 0.4]}>
        <group ref={turn} position={[0, 2, 0]}>
          <primitive object={root} />
        </group>
      </Float>
    </group>
  );
}

/** The glade: an arc of exhibits facing the path, lit from the middle. */
export function Glade() {
  const names = GLADE_MODELS;
  const [cx, , cz] = GLADE.center;
  return (
    <group>
      {names.map((name, i) => {
        // Spread across the far side of the glade, facing the arriving camera.
        const a = MathUtils.degToRad(-75 + (150 / (names.length - 1)) * i);
        const pos: V3 = [cx + Math.sin(a) * GLADE.radius, 0, cz - Math.cos(a) * GLADE.radius * 0.75];
        return <Exhibit key={name} name={name} position={pos} spin={0.35 + (i % 3) * 0.12} />;
      })}
      <pointLight position={[cx, 5, cz + 1]} color="#ffe0a0" intensity={40} distance={18} decay={1.5} />
    </group>
  );
}
