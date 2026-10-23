// The landing page's window onto the Big House: the real house with its upper floor lifted
// off like a dollhouse, the camera circling slowly, and three hiders on the ground floor,
// disguised as props, who can't quite keep still. No sim, no room: just the art.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { BIG_HOUSE, HOUSE_SCALE, UPSTAIRS, houseFor, newHouseSeed, type PropKind } from "@shadow/shared";
import { Vector3, type Group } from "three";
import { House } from "./House";
import { PropModel } from "./PropArt";
import { wiggleAt } from "./Play";

/** The middle of the property, which the camera circles. */
const CENTRE = new Vector3(16 * HOUSE_SCALE, 0, 36 * HOUSE_SCALE);
/** How far out and how high the camera circles, and how fast (radians a second). */
const ORBIT = { radius: 64, height: 62, speed: 0.045 };
/** A hider twitches once every this many seconds, for a moment. */
const TWITCH_EVERY = 3.2;
const TWITCH_FOR = 0.55;

function Orbit() {
  useFrame(({ camera, clock }) => {
    const a = clock.elapsedTime * ORBIT.speed + 0.6;
    camera.position.set(CENTRE.x + Math.cos(a) * ORBIT.radius, ORBIT.height, CENTRE.z + Math.sin(a) * ORBIT.radius);
    camera.lookAt(CENTRE.x, 0, CENTRE.z - 4);
  });
  return null;
}

/** A hider in disguise: still, then a wobble, each on its own beat. */
function Hider({ kind, at, beat }: { kind: PropKind; at: { x: number; y: number; z: number }; beat: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + beat) % TWITCH_EVERY;
    const k = t < TWITCH_FOR ? 1 - t / TWITCH_FOR : 0;
    if (ref.current) ref.current.rotation.z = wiggleAt(k);
  });
  return (
    <group ref={ref} position={[at.x, at.y, at.z]}>
      <Suspense fallback={null}>
        <PropModel kind={kind} />
      </Suspense>
    </group>
  );
}

function Scene() {
  const map = useMemo(() => houseFor(newHouseSeed()), []);
  // Three hiders on the ground floor, each as a different thing you could hide as.
  const hiders = useMemo(() => {
    const kinds = Object.values(map.kinds).filter((k) => k.disguise);
    return BIG_HOUSE.hiderSpawns
      .filter((s) => s.y < UPSTAIRS - 1)
      .slice(0, 3)
      .map((at, i) => ({ at, kind: kinds[(i * 7 + 3) % kinds.length], beat: i * 1.1 }));
  }, [map]);

  return (
    <>
      <color attach="background" args={["#cfe3f0"]} />
      <Suspense fallback={null}>
        <Environment files="/prop-hunt/hdri/sky.hdr" background backgroundBlurriness={0.03} environmentIntensity={0.6} />
      </Suspense>
      <fog attach="fog" args={["#cfe3f0", 120, 260]} />
      <hemisphereLight args={["#e6eef5", "#8a7a63", 0.55]} />
      <directionalLight
        position={[CENTRE.x + 80, 120, CENTRE.z + 90]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={400}
      />
      <House map={map} below={UPSTAIRS - 1} />
      {hiders.map((h, i) => (
        <Hider key={i} {...h} />
      ))}
      <Orbit />
    </>
  );
}

export default function Preview({ paused = false }: { paused?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      frameloop={paused ? "never" : "always"}
      camera={{ fov: 40, near: 0.5, far: 600, position: [CENTRE.x, ORBIT.height, CENTRE.z + ORBIT.radius] }}
      gl={{ antialias: true }}
    >
      <Scene />
    </Canvas>
  );
}
