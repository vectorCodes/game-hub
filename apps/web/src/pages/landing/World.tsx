// The landing page's 3D world. Lazy-loaded so the page's text renders before three.js.
import { Suspense, useMemo, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { journey } from "./journey";
import { MOON, STOPS } from "./world/layout";
import { Forest, Grass, Ground, Moon, Mountains, Rocks, Sky, WindClock } from "./world/Nature";
import { Bats, Lamps } from "./world/Life";
import { Glade, ShadowWall } from "./world/Story";
import { detectWeakDevice, PERFORMANCE_LEVELS, QualityContext } from "./world/quality";

/** Flies the camera between the section stops as the page scrolls, with damping. */
function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  // Preallocated so the per-frame camera math creates no garbage (no GC hitches mid-scroll).
  const goal = useMemo(
    () => ({ position: new Vector3(), target: new Vector3(), next: new Vector3(), look: new Vector3(...STOPS[0].target) }),
    [],
  );

  useFrame(({ clock }, delta) => {
    // Portrait screens see a narrower slice, so widen the lens.
    const fov = aspect < 1 ? 64 : 50;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const c = journey.still ? 0 : MathUtils.clamp(journey.chapter, 0, STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(c));
    const f = c - i;
    goal.position.fromArray(STOPS[i].position).lerp(goal.next.fromArray(STOPS[i + 1].position), f);
    goal.target.fromArray(STOPS[i].target).lerp(goal.next.fromArray(STOPS[i + 1].target), f);

    // A slow handheld drift keeps every stop alive.
    if (!journey.still) {
      const t = clock.elapsedTime;
      goal.position.x += Math.sin(t * 0.31) * 0.12;
      goal.position.y += Math.sin(t * 0.43) * 0.08;
    }

    const k = journey.still ? 1 : 1 - Math.exp(-delta * 3.2);
    camera.position.lerp(goal.position, k);
    goal.look.lerp(goal.target, k);
    camera.lookAt(goal.look);
  });
  return null;
}

export default function World() {
  // Weak devices start without bloom; anyone steps down further if frames drop.
  const weak = useMemo(detectWeakDevice, []);
  const [level, setLevel] = useState(weak ? 2 : 0);
  const settings = PERFORMANCE_LEVELS[level];
  const quality = useMemo(() => ({ weak, level }), [weak, level]);
  const [ready, setReady] = useState(false);
  return (
    <div className="h-full w-full transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
      <Canvas
        shadows
        dpr={settings.dpr}
        camera={{ fov: 50, near: 0.1, far: 500, position: STOPS[0].position }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={() => setReady(true)}
      >
        <QualityContext value={quality}>
          {/* Below ~45 fps (or 50 on high-refresh screens) for a sustained stretch, step down a level.
              Never steps back up, so quality doesn't flicker between levels. */}
          <PerformanceMonitor
            bounds={(refresh) => (refresh > 90 ? [50, 90] : [45, 60])}
            flipflops={2}
            onDecline={() => setLevel((l) => Math.min(PERFORMANCE_LEVELS.length - 1, l + 1))}
            onFallback={() => setLevel(PERFORMANCE_LEVELS.length - 1)}
          />
          {/* Daylight on paper: distance fades into a paper haze, like an ink-wash print. */}
          <color attach="background" args={["#f3ead9"]} />
          <fog attach="fog" args={["#f1e7d4", 22, 115]} />
          <hemisphereLight args={["#fff8ec", "#b9a27c", weak ? 1.1 : 0.9]} />
          <directionalLight position={MOON} color="#fff1dc" intensity={1.1} />

          <WindClock />
          <CameraRig />
          <Sky />
          <Moon />
          <Mountains />
          <Ground />
          <Grass count={weak ? 7000 : 22000} density={settings.density} />
          <Forest count={weak ? 160 : 320} density={settings.density} />
          <Rocks />
          <Lamps />
          {/* Ink silhouettes against the paper sky: they read as birds by day. */}
          <Bats />
          <Suspense fallback={null}>
            <ShadowWall />
            <Glade />
          </Suspense>

          {settings.bloom && (
            <EffectComposer multisampling={4}>
              {/* Only the lanterns glow: the paper itself is bright, so the threshold sits above it. */}
              <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.1} luminanceSmoothing={0.1} />
            </EffectComposer>
          )}
        </QualityContext>
      </Canvas>
    </div>
  );
}
