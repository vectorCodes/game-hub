// The Bumper Arena canvas: the fixed-step loop that drives the sim (player input, bots,
// events), the camera that frames the whole arena, the light, and the world.
import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type PerspectiveCamera } from "three";
import { play } from "../../../lib/sound";
import { input } from "../input";
import { emitBumperEvent, game, ME, onBumperEvent, syncHud, useBumper } from "../store";
import { Arena, Clouds } from "./Arena";
import { Puffs } from "./Puffs";
import { Rider } from "./Rider";

const STEP = 1 / 60;
/** Camera pitch: high enough to see the action, low enough to feel the drop. */
const PITCH = MathUtils.degToRad(56);

function Loop() {
  const acc = useRef(0);
  /** Hit-stop: a big hit freezes the game for a blink. */
  const freeze = useRef(0);

  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type === "hit" && e.dash && e.power > 1) freeze.current = 0.06;
      }),
    [],
  );

  useFrame((_, frame) => {
    const sim = game.sim;
    if (!sim) return;
    const dt = Math.min(frame, 0.1);
    if (freeze.current > 0) {
      freeze.current -= dt;
      return;
    }
    acc.current += dt;
    while (acc.current >= STEP) {
      acc.current -= STEP;
      const me = sim.ring(ME);
      // Screen up is away from the camera: -z.
      if (me) me.input = { x: input.x, z: -input.y, dash: input.dashPressed, brace: input.brace };
      input.dashPressed = false;
      for (const brain of game.brains) {
        const ring = sim.ring(brain.id);
        if (ring) ring.input = brain.think(sim);
      }
      sim.step(STEP);
      for (const e of sim.events) emitBumperEvent(e, sim);
      sim.events.length = 0;
    }
    syncHud(sim);
  });
  return null;
}

/** Sounds for what happens in the arena. */
function Sounds() {
  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type === "hit" && e.power > 0.35) play("boing", Math.min(1, e.power / 2));
        if (e.type === "fall") play("whistle");
        if (e.type === "warn") play("alarm");
        if (e.type === "drop") play("thunder", 0.5);
        if (e.type === "over") play(e.winner === ME ? "win" : "lose");
        if (e.type === "dash" && e.id === ME) play("jump");
      }),
    [],
  );
  return null;
}

/** The camera never frames less than this much floor around the action (m, either way). */
const MIN_VIEW = 6.5;
/** Room around the outermost rings (m). */
const VIEW_MARGIN = 2.8;

/**
 * Frames the rings still on the arena (yours always among them while you're in), so riders
 * stay big on a big plate; it pulls back as they spread out, never past the whole plate.
 */
function CameraRig() {
  const { camera, size } = useThree();
  const shake = useRef(0);
  const view = useRef<{ x: number; z: number; hw: number; hd: number } | null>(null);

  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type === "hit") shake.current = Math.max(shake.current, Math.min(0.4, e.power * 0.06 * (e.dash ? 2.2 : 1)));
        if (e.type === "drop") shake.current = Math.max(shake.current, 0.2);
      }),
    [],
  );

  useFrame((_, dt) => {
    const sim = game.sim;
    if (!sim) return;
    const cam = camera as PerspectiveCamera;
    const rings = sim.alive().length ? sim.alive() : sim.rings;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const r of rings) {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minZ = Math.min(minZ, r.z);
      maxZ = Math.max(maxZ, r.z);
    }
    const whole = sim.radius + 1;
    const want = {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      hw: Math.min(whole, Math.max(MIN_VIEW, (maxX - minX) / 2 + VIEW_MARGIN)),
      hd: Math.min(whole, Math.max(MIN_VIEW, (maxZ - minZ) / 2 + VIEW_MARGIN)),
    };
    // Framing the whole plate: centre it.
    if (want.hw >= whole && want.hd >= whole) want.x = want.z = 0;
    const v = (view.current ??= { ...want });
    const k = 1 - Math.exp(-dt * 1.6);
    v.x = MathUtils.lerp(v.x, want.x, k);
    v.z = MathUtils.lerp(v.z, want.z, k);
    v.hw = MathUtils.lerp(v.hw, want.hw, k);
    v.hd = MathUtils.lerp(v.hd, want.hd, k);

    const vHalf = MathUtils.degToRad(cam.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / size.height));
    const dist = Math.max(v.hw / Math.tan(hHalf), (v.hd * 0.92) / Math.tan(vHalf));
    shake.current = Math.max(0, shake.current - dt * 1.6);
    const s = shake.current;
    cam.position.set(v.x + (Math.random() - 0.5) * s, Math.sin(PITCH) * dist + (Math.random() - 0.5) * s, v.z + Math.cos(PITCH) * dist);
    cam.lookAt(v.x, -0.4, v.z + 0.3);
  });
  return null;
}

function Riders() {
  const entrants = useBumper((s) => s.entrants);
  return entrants.map((e) => <Rider key={e.id} entrant={e} />);
}

export default function Game() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, near: 0.5, far: 200, position: [0, 14, 10] }} gl={{ antialias: true }}>
      <color attach="background" args={["#cfe6ee"]} />
      <fog attach="fog" args={["#cfe6ee", 30, 75]} />
      <hemisphereLight args={["#fff8ea", "#9cb8c8", 1.6]} />
      <directionalLight
        position={[6, 16, 9]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
      />
      <Loop />
      <Sounds />
      <CameraRig />
      <Arena />
      <Clouds />
      <Riders />
      <Puffs />
    </Canvas>
  );
}
