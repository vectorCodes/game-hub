// The Bumper Arena canvas: the fixed-step loop that drives the sim (player input, bots,
// events; in a party room, net.ts draws what the room says instead), the camera that frames the whole arena, the light, and the world.
import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type PerspectiveCamera } from "three";
import { SPINNER } from "@shadow/shared";
import { play } from "../../../lib/sound";
import { input } from "../input";
import { partyFrame } from "../net";
import { emitBumperEvent, game, ME, onBumperEvent, syncHud, useBumper } from "../store";
import { Arena, Clouds } from "./Arena";
import { Decor } from "./Decor";
import { Pickups } from "./Pickups";
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
    const { mode, backdrop } = useBumper.getState();
    if (mode === "party" && !backdrop) return partyFrame(dt);
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

/** Where a sound is, heard from your car (or the middle, once you're out): quieter far off, panned to its side. */
function heard(x: number, z: number) {
  const me = game.sim?.ring(ME);
  const [cx, cz] = me && me.state === "in" ? [me.x, me.z] : [0, 0];
  const d = Math.hypot(x - cx, z - cz);
  return { volume: Math.max(0.12, 1 - d / 18), pan: (x - cx) / 12 };
}

/** Sounds for what happens in the arena, and each map's own: the Spinner's bar, ice, hive tiles, the plate's rim. */
function Sounds() {
  const lastTile = useRef(0);
  const barSide = useRef(0);

  useEffect(
    () =>
      onBumperEvent((e, sim) => {
        const map = sim.map.id;
        if (e.type === "hit" && e.a === "spinner") play("barClang", Math.min(1, 0.5 + e.power / 3), heard(e.x, e.z));
        else if (e.type === "hit" && e.power > 0.35) play("boing", Math.min(1, e.power / 2));
        if (e.type === "fall") play("whistle");
        if (e.type === "warn") play("alarm");
        if (e.type === "drop") {
          if (map === "ice-floe") play("iceCrack");
          else if (map === "hex-hive") play("tileDrop");
          else play("plateCrumble");
        }
        // Hive tiles: one at a time, so a burst doesn't turn into a roar.
        if ((e.type === "crack" || e.type === "tileDrop") && performance.now() - lastTile.current > 90) {
          lastTile.current = performance.now();
          play(e.type === "crack" ? "tileCrack" : "tileDrop", 1, heard(e.x, e.z));
        }
        if (e.type === "over") play(e.winner === ME ? "win" : "lose");
        if (e.type === "dash" && e.id === ME) play(map === "ice-floe" ? "iceSkid" : "jump");
        // Pickups: yours loud, others' where they are.
        if (e.type === "pickup") play(e.id === ME ? "powerup" : "coin", e.id === ME ? 1 : 0.6, e.id === ME ? undefined : heard(e.x, e.z));
        if (e.type === "spawn") play("tick", 0.6, heard(e.x, e.z));
        if (e.type === "shock") play("boom", 0.8, heard(e.x, e.z));
        if (e.type === "pop") play("shield");
        if (e.type === "slip") play("iceSkid");
      }),
    [],
  );

  // The Spinner's bar: a swoosh each time it sweeps past your car.
  useFrame(() => {
    const sim = game.sim;
    const me = sim?.ring(ME);
    if (!sim || sim.map.kind !== "spinner" || sim.phase !== "play" || !me || me.state !== "in") {
      barSide.current = 0;
      return;
    }
    const { angle } = sim.spinner;
    const along = me.x * Math.sin(angle) + me.z * Math.cos(angle);
    const across = me.x * Math.cos(angle) - me.z * Math.sin(angle);
    const side = Math.sign(across);
    if (barSide.current && side && side !== barSide.current && Math.abs(along) > SPINNER.hubRadius) play("barSwoosh", 1);
    if (side) barSide.current = side;
  });
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
function CameraRig({ close = false }: { close?: boolean }) {
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
    // Nobody left on the arena: frame the whole plate, not the rings falling away below it.
    const rings = sim.alive().length ? sim.alive() : [{ x: -sim.radius, z: -sim.radius }, { x: sim.radius, z: sim.radius }];
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
    // The countdown and a backdrop: the whole arena and what's around it, before the camera
    // moves in on the action. `close` (the landing's window) stays in on the rings instead.
    if (sim.phase === "countdown" || (useBumper.getState().backdrop && !close)) {
      want.x = want.z = 0;
      want.hw = want.hd = sim.startRadius + 5;
    }
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

/**
 * The game, or with `preview` a silent window onto it (the landing page's: no sounds, a
 * lighter resolution, and no frames at all while `paused`).
 */
export default function Game({ preview = false, paused = false }: { preview?: boolean; paused?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={preview ? [1, 1.5] : [1, 2]}
      frameloop={paused ? "never" : "always"}
      camera={{ fov: 40, near: 0.5, far: 200, position: [0, 14, 10] }}
      gl={{ antialias: true }}
    >
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
      {!preview && <Sounds />}
      <CameraRig close={preview} />
      <Arena />
      <Decor />
      <Clouds />
      <Pickups />
      <Riders />
      <Puffs />
    </Canvas>
  );
}
