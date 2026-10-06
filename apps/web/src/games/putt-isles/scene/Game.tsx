// Putt Isles' 3D scene. Lazy-loaded with the play page, so three.js and the physics stay
// off the hub.
import { Suspense, use, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { PUTT_HOLES } from "@shadow/shared";
import { play } from "../../../lib/sound";
import { courseCollision } from "../collision";
import { AIM, CAMERA, PHYSICS } from "../config";
import { buildHole, piecesOf, type HoleLayout } from "../course";
import { aim, cancelAim, strike, STRIKE_DELAY, updateAim, view, zoom } from "../input";
import { loadRapier, PuttWorld } from "../physics";
import { usePutt } from "../store";
import { AimGuide } from "./AimGuide";
import { Ball } from "./Ball";
import { Course } from "./Course";
import { Golfer } from "./Golfer";
import { Clouds, Island, SkyAndLight } from "./Environment";
import { emitPuttEvent, frameClock, pieceTriangles, preloadPieces, PuttContext, usePuttScene, useKitPieces } from "./shared";

/** Pieces drawn but not part of any hole's layout. */
const EXTRA = ["support-low", "flag-red", "ball-red", "club-red"];
/** Every piece any hole can use (turning a hole doesn't change its pieces), loaded once. */
const ALL_PIECES = [...new Set([...piecesOf(PUTT_HOLES.map(buildHole)), ...EXTRA])];
preloadPieces(ALL_PIECES);

/** Seconds a ball stays gone after going out, before it's back where it was hit from. */
const OUT_TIME = 0.9;

/** Steps the physics at its fixed rate and turns its events into sounds and HUD updates. */
function Driver() {
  const { world } = usePuttScene();
  const acc = useRef(0);
  const outFor = useRef(0);
  // A shot let go just as the hole changes doesn't carry over.
  useEffect(
    () => () => {
      strike.pending = false;
    },
    [],
  );

  useFrame((_, raw) => {
    // The putter meets the ball a beat after the shot is let go.
    if (strike.pending && performance.now() >= strike.at) {
      strike.pending = false;
      world.shoot(strike.yaw, strike.power);
    }
    // Long frames (a background tab) are capped: the ball just runs slow for a moment.
    acc.current += Math.min(raw, 1 / 15);
    let steps = 0;
    while (acc.current >= PHYSICS.tick && steps < 12) {
      world.step();
      acc.current -= PHYSICS.tick;
      steps++;
    }
    frameClock.alpha = acc.current / PHYSICS.tick;

    const store = usePutt.getState();
    for (const e of world.events) {
      emitPuttEvent(e, world);
      switch (e.type) {
        case "shot":
          play("putt", e.power);
          store.shot();
          break;
        case "wall":
          play("clack", Math.min(1, e.speed / 4));
          break;
        case "sink":
          play("plunk");
          store.sink();
          break;
        case "out":
          play("splash");
          store.out();
          outFor.current = OUT_TIME;
          break;
        case "rest":
          store.rest();
          break;
      }
    }
    world.events.length = 0;

    if (outFor.current > 0) {
      outFor.current -= raw;
      if (outFor.current <= 0) {
        world.place(world.lastRest);
        usePutt.getState().backIn();
      }
    }
  });
  return null;
}

/**
 * Orbits the ball from behind and above; turns with the keys, the buttons or a right-drag.
 * The overview pulls up high over the whole hole.
 */
function CameraRig() {
  const { world, hole } = usePuttScene();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const v = useMemo(() => ({ target: new Vector3(), goal: new Vector3(), pos: new Vector3(), ready: false, over: 0 }), []);

  // Each hole starts looking out of the tee.
  useEffect(() => {
    view.yaw = hole.teeYaw;
    v.ready = false;
  }, [hole, v]);

  useFrame((_, dt) => {
    view.yaw += (view.turn + view.buttonTurn) * CAMERA.turnSpeed * dt;
    const { overview } = usePutt.getState();
    v.over += ((overview ? 1 : 0) - v.over) * (1 - Math.exp(-dt * 4));

    const a = frameClock.alpha;
    const bx = world.prev.x + (world.pos.x - world.prev.x) * a;
    const by = world.prev.y + (world.pos.y - world.prev.y) * a;
    const bz = world.prev.z + (world.pos.z - world.prev.z) * a;

    // Blend between following the ball and the overview of the whole hole.
    const { minX, maxX, minZ, maxZ } = hole.bounds;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ);
    const o = v.over;
    v.goal.set(bx + (cx - bx) * o, by, bz + (cz - bz) * o);
    const portrait = aspect < 0.9;
    const dist = view.distance * (portrait ? 1.35 : 1) * (1 - o) + (span * (portrait ? 1.5 : 1.05) + 1.5) * o;
    const pitch = CAMERA.pitch + (1.2 - CAMERA.pitch) * o;

    const k = v.ready ? 1 - Math.exp(-dt * 5) : 1;
    v.target.lerp(v.goal, k);
    const fx = Math.sin(view.yaw);
    const fz = Math.cos(view.yaw);
    const back = Math.cos(pitch) * dist;
    v.pos.set(v.target.x - fx * back, v.target.y + Math.sin(pitch) * dist, v.target.z - fz * back);
    if (v.ready) camera.position.lerp(v.pos, 1 - Math.exp(-dt * 8));
    else camera.position.copy(v.pos);
    v.ready = true;
    camera.lookAt(v.target);

    const fov = portrait ? 60 : 48;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/** Loads the kit and the physics, builds the hole's world, and draws it. */
function HoleScene({ hole, attempt }: { hole: HoleLayout; attempt: number }) {
  const R = use(loadRapier());
  const kit = useKitPieces(ALL_PIECES);
  const collision = useMemo(() => {
    const used = [...new Set(hole.tiles.map((t) => t.piece))];
    const pieces = Object.fromEntries(used.map((p) => [p, pieceTriangles(kit[p])]));
    return courseCollision(hole, pieces);
  }, [hole, kit]);
  const [world, setWorld] = useState<PuttWorld | null>(null);

  useEffect(() => {
    const w = new PuttWorld(R, collision, hole.tee, hole.cup);
    setWorld(w);
    return () => w.dispose();
  }, [R, collision, hole, attempt]);

  const scene = useMemo(() => (world ? { world, hole } : null), [world, hole]);
  if (!scene) return null;

  return (
    <PuttContext value={scene}>
      <WorldBridge />
      <Driver />
      <CameraRig />
      <SkyAndLight />
      <Clouds />
      <Island />
      <Course kit={kit} />
      <Ball kit={kit} />
      <Suspense fallback={null}>
        <Golfer kit={kit} />
      </Suspense>
      <AimGuide />
    </PuttContext>
  );
}

/** The world that's live right now, for the pointer handlers outside the canvas. */
let liveWorld: PuttWorld | null = null;

function WorldBridge() {
  const { world } = usePuttScene();
  useEffect(() => {
    liveWorld = world;
    return () => {
      if (liveWorld === world) liveWorld = null;
    };
  }, [world]);
  return null;
}

export default function Game() {
  const hole = usePutt((s) => s.holes[s.holeIndex]);
  const attempt = usePutt((s) => s.attempt);
  const holeIndex = usePutt((s) => s.holeIndex);
  const seed = usePutt((s) => s.seed);
  const rotating = useRef<{ id: number; x: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const onDown = (e: ReactPointerEvent) => {
    if (e.button === 2) {
      rotating.current = { id: e.pointerId, x: e.clientX };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    // A second finger while aiming calls the shot off.
    if (aim.active) return cancelAim();
    if (usePutt.getState().phase !== "aim" || !liveWorld || strike.pending) return;
    aim.active = true;
    aim.pointer = e.pointerId;
    aim.startX = e.clientX;
    aim.startY = e.clientY;
    aim.power = 0;
    aim.yaw = view.yaw;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent) => {
    const r = rotating.current;
    if (r && r.id === e.pointerId) {
      view.yaw -= (e.clientX - r.x) * 0.008;
      r.x = e.clientX;
      return;
    }
    if (aim.active && aim.pointer === e.pointerId && box.current) {
      updateAim(e.clientX, e.clientY, box.current.getBoundingClientRect());
    }
  };

  const onUp = (e: ReactPointerEvent) => {
    if (rotating.current?.id === e.pointerId) rotating.current = null;
    if (!aim.active || aim.pointer !== e.pointerId) return;
    if (aim.power >= AIM.minPower && usePutt.getState().phase === "aim" && liveWorld) {
      Object.assign(strike, { pending: true, yaw: aim.yaw, power: aim.power, at: performance.now() + STRIKE_DELAY * 1000 });
    }
    cancelAim();
  };

  // Escape calls a shot off.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && cancelAim();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div
      ref={box}
      className="absolute inset-0"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        cancelAim();
        rotating.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => zoom(e.deltaY * 0.0025)}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 48, near: 0.05, far: 400, position: [0, 3, 6] }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Suspense fallback={null}>
          <HoleScene key={`${seed}-${holeIndex}-${attempt}`} hole={hole} attempt={attempt} />
        </Suspense>
      </Canvas>
    </div>
  );
}
