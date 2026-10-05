// GameHub's hero scene: the logo's lamp hovering over a turntable of objects. They circle
// under the light and their shadows sweep across the floor. Lazy-loaded so the page's text
// renders before three.js.
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Box3, Vector3, type Group, type Mesh, type PerspectiveCamera } from "three";
import { GLADE_MODELS, landingModel, WALL_MODEL } from "../landing/assets";
import { detectWeakDevice } from "../landing/world/quality";

const MODELS = [WALL_MODEL, ...GLADE_MODELS];
const RING = 3.3;
const LAMP_HEIGHT = 4.4;
for (const m of MODELS) useGLTF.preload(landingModel(m));

const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A catalog model on its plinth: scaled so its largest side is `size`, standing on y = 0. */
function Exhibit({ name, angle, size = 1.2 }: { name: string; angle: number; size?: number }) {
  const { scene } = useGLTF(landingModel(name));
  const root = useMemo(() => {
    const r = scene.clone(true);
    r.updateMatrixWorld(true);
    const box = new Box3().setFromObject(r);
    const s = size / Math.max(...box.getSize(new Vector3()).toArray());
    const center = box.getCenter(new Vector3());
    r.scale.setScalar(s);
    r.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    r.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = true;
    });
    return r;
  }, [scene, size]);

  const spin = useRef<Group>(null);
  useFrame((_, delta) => {
    if (spin.current && !still) spin.current.rotation.y += delta * 0.4;
  });

  return (
    <group position={[Math.cos(angle) * RING, 0, Math.sin(angle) * RING]}>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <cylinderGeometry args={[0.56, 0.64, 0.14, 40]} />
        <meshStandardMaterial color="#2a352d" roughness={0.85} />
      </mesh>
      <Float enabled={!still} speed={1.3} floatIntensity={0.5} rotationIntensity={0.1} floatingRange={[0.3, 0.6]}>
        <group ref={spin} position={[0, 0.3, 0]} rotation={[0, angle, 0]}>
          <primitive object={root} />
        </group>
      </Float>
    </group>
  );
}

/** The ring of exhibits, turning slowly under the lamp. */
function Turntable() {
  const ring = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ring.current && !still) ring.current.rotation.y += delta * 0.07;
  });
  return (
    <group ref={ring}>
      {MODELS.map((name, i) => (
        <Exhibit key={name} name={name} angle={(i / MODELS.length) * Math.PI * 2 + 0.3} />
      ))}
    </group>
  );
}

/** A die on the centre pedestal: the hub's "pick a game" in one object. */
function Die() {
  const die = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!die.current || still) return;
    die.current.rotation.x += delta * 0.25;
    die.current.rotation.y += delta * 0.4;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.95, 1.1, 0.6, 48]} />
        <meshStandardMaterial color="#263029" roughness={0.8} />
      </mesh>
      <Float enabled={!still} speed={1.6} floatIntensity={0.8} rotationIntensity={0} floatingRange={[0.2, 0.5]}>
        <mesh ref={die} position={[0, 1.45, 0]} castShadow>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#efe6d2" roughness={0.55} flatShading />
        </mesh>
      </Float>
    </group>
  );
}

/** The logo's lamp: a warm orb that lights the scene and casts every shadow. */
function Lamp({ weak }: { weak: boolean }) {
  return (
    <>
      <Float enabled={!still} speed={1.1} floatIntensity={0.35} rotationIntensity={0} floatingRange={[-0.1, 0.1]}>
        <group position={[0, LAMP_HEIGHT, 0]}>
          <mesh>
            <sphereGeometry args={[0.38, 48, 48]} />
            <meshStandardMaterial color="#fdf1d3" emissive="#f4b94e" emissiveIntensity={weak ? 1.6 : 4} toneMapped={false} />
          </mesh>
          <mesh scale={2.4}>
            <sphereGeometry args={[0.38, 32, 32]} />
            <meshBasicMaterial color="#f4b94e" transparent opacity={0.07} depthWrite={false} />
          </mesh>
          <pointLight color="#f8cf72" intensity={18} distance={16} decay={2} />
        </group>
      </Float>
      {/* The shadow caster: one spotlight straight down keeps it to a single shadow map. */}
      <spotLight
        position={[0, LAMP_HEIGHT, 0]}
        color="#f8cf72"
        intensity={90}
        angle={1.15}
        penumbra={0.7}
        decay={2}
        distance={30}
        castShadow
        shadow-mapSize={weak ? 1024 : 2048}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
    </>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#18211b" roughness={1} />
      </mesh>
      {/* The turntable's rim: a faint moss line the exhibits ride on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[RING - 0.02, RING + 0.02, 128]} />
        <meshBasicMaterial color="#8fc76a" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </>
  );
}

/**
 * Frames the scene: to the right of the headline on wide screens, below it on narrow ones.
 * The pointer nudges the camera for a little parallax.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const pointer = useThree((s) => s.pointer);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const v = useMemo(() => ({ goal: new Vector3(), look: new Vector3(), lookGoal: new Vector3() }), []);

  useFrame((_, delta) => {
    const wide = aspect > 1.15;
    const fov = wide ? 42 : 58;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // Looking left of the scene pushes it right, clear of the headline.
    const shift = wide ? -4.6 : 0;
    const px = still ? 0 : pointer.x;
    const py = still ? 0 : pointer.y;
    v.goal.set(shift + px * 0.9, (wide ? 4.2 : 5.6) + py * 0.4, wide ? 11.5 : 13);
    v.lookGoal.set(shift, wide ? 1.7 : 0.6, 0);
    const k = still ? 1 : 1 - Math.exp(-delta * 2.5);
    camera.position.lerp(v.goal, k);
    v.look.lerp(v.lookGoal, k);
    camera.lookAt(v.look);
  });
  return null;
}

export default function HubWorld({ active }: { active: boolean }) {
  const weak = useMemo(detectWeakDevice, []);
  const [ready, setReady] = useState(false);
  return (
    <div className="h-full w-full transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
      <Canvas
        shadows
        frameloop={active ? "always" : "never"}
        dpr={weak ? 1 : [1, 1.75]}
        camera={{ fov: 42, near: 0.1, far: 100, position: [-4.6, 4.2, 11.5] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={() => setReady(true)}
      >
        <color attach="background" args={["#0e1411"]} />
        <fog attach="fog" args={["#0e1411", 13, 30]} />
        <hemisphereLight args={["#5e7a66", "#0e1411", 0.45]} />
        <CameraRig />
        <Lamp weak={weak} />
        <Floor />
        <Die />
        <Suspense fallback={null}>
          <Turntable />
        </Suspense>
        <Sparkles count={weak ? 40 : 90} scale={[16, 6, 16]} position={[0, 3, 0]} size={2.5} speed={still ? 0 : 0.3} color="#f8cf72" opacity={0.6} />
        {!weak && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.8} luminanceSmoothing={0.2} />
            <Vignette offset={0.25} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
