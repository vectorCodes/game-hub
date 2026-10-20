// Walking the house: the loop that steps the simulation, your avatar, and the third-person
// camera that orbits it with the mouse and pulls in rather than going through a wall.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { LoopOnce, LoopRepeat, MathUtils, Vector3, type AnimationAction, type AnimationClip, type Group, type Mesh, type Object3D, type PerspectiveCamera } from "three";
import { areaAt, UPSTAIRS, type HuntPose } from "@shadow/shared";
import { animateAccessories } from "../../../avatar/build";
import { useAvatar } from "../../../avatar/store";
import { useAvatarModel } from "../../../avatar/useAvatarModel";
import { play, type Sound } from "../../../lib/sound";
import { CAMERA } from "../config";
import { angleDelta } from "../math";
import { actions, input, look, lookKeys } from "../input";
import {
  addLocalDecoy,
  allRemotes,
  decoysLeft,
  getRemote,
  inMatch,
  isDizzy,
  isFrozen,
  isSpectating,
  mayDisguise,
  mayZap,
  sampleRemote,
  SEND_EVERY,
  sendDecoy,
  sendDisguise,
  sendPosition,
  sendSonar,
  sendTaunt,
  type Frame,
} from "../net";
import { pickTaunt } from "../progress";
import { useHunt } from "../store";
import { rayBoxes, type HuntSim, type SimEvent } from "../sim";

/** Where the camera is looking from: shared by the camera (which turns it) and the sim (which moves relative to it). */
export interface View {
  yaw: number;
  pitch: number;
  distance: number;
  /**
   * The yaw movement keys are read against. It's held while the same keys stay down, so the
   * follow cam can swing round behind you without bending your path; it catches up with the
   * camera whenever the keys change or the mouse moves.
   */
  moveYaw: number;
}

export const newView = (): View => ({ yaw: 0, pitch: CAMERA.pitch, distance: CAMERA.distance, moveYaw: 0 });

type Listener = (e: SimEvent) => void;

/** What the sim gets while you're frozen (the countdown, or blindfolded in the garage). */
const STILL = { x: 0, y: 0, jumpHeld: false, jumpPressed: false, sprint: false };

const OUTSIDE = new Set(["Garden", "Side path", "Shed"]);

/** Further than this in a frame: the watched player teleported (or we switched), so no follow swing. */
const JUMP_CUT = 4;
const watchedFrame: Frame = { t: 0, x: 0, y: 0, z: 0, facing: 0, pose: "idle", locked: false };

/**
 * Out of the round (found): instead of walking, we ride along with another player, and the
 * camera follows them as it would us. Space (or Jump) moves on to the next player.
 */
function watch(sim: HuntSim, dt: number) {
  // Players only: decoys stand still.
  const ids = [...allRemotes()].filter((r) => r.frames.length > 0 && !r.still).map((r) => r.id);
  const current = useHunt.getState().watching;
  let i = current === null ? -1 : ids.indexOf(current);
  if (input.jumpPressed) {
    input.jumpPressed = false;
    i = ids.length ? (i + 1) % ids.length : -1;
  } else if (i < 0) i = ids.length ? 0 : -1;
  const id = i < 0 ? null : ids[i];
  if (id !== current) useHunt.setState({ watching: id });
  const r = id === null ? undefined : getRemote(id);
  if (!r || !sampleRemote(r, performance.now(), watchedFrame)) return;
  const pl = sim.player;
  const f = watchedFrame;
  const cut = Math.hypot(f.x - pl.x, f.z - pl.z) > JUMP_CUT || dt <= 0;
  pl.vx = cut ? 0 : (f.x - pl.x) / dt;
  pl.vz = cut ? 0 : (f.z - pl.z) / dt;
  pl.vy = 0;
  Object.assign(pl, { x: f.x, y: f.y, z: f.z, facing: f.facing, grounded: true });
}

/** Steps the simulation in small fixed slices (stable collisions at any frame rate). */
export function Driver({ sim, view, onEvent }: { sim: HuntSim; view: View; onEvent: Listener }) {
  const spawn = useRef(0);
  const keys = useRef({ x: 0, y: 0 });
  const sendClock = useRef(0);
  useFrame((_, delta) => {
    // New keys (or none): movement is read against where the camera looks now.
    if (input.x !== keys.current.x || input.y !== keys.current.y || (input.x === 0 && input.y === 0)) view.moveYaw = view.yaw;
    keys.current = { x: input.x, y: input.y };
    const match = inMatch();
    // Found, or a seeker: back to yourself (the room has already said so to everyone else).
    if (match && !mayDisguise() && sim.disguise) sim.become(null);
    if (actions.respawn) {
      actions.respawn = false;
      // Teleporting is a sandbox thing; in a match, R is the seekers' sonar.
      if (match) actions.sonar = true;
      else {
        const spots = [...sim.map.hiderSpawns, sim.map.seekerSpawn];
        spawn.current = (spawn.current + 1) % spots.length;
        sim.spawnAt(spots[spawn.current], view.yaw + Math.PI);
      }
    }
    if (actions.sonar) {
      actions.sonar = false;
      // The room checks it's unlocked and unused, and answers only us.
      if (mayZap()) sendSonar();
    }
    if (actions.become) {
      actions.become = false;
      const id = useHunt.getState().aimed;
      const prop = id === null ? undefined : sim.map.props[id];
      if (id !== null && prop && mayDisguise()) {
        const kind = sim.map.kinds[prop.kind];
        // Start out turned like the prop you copied, so it sits among its twins.
        sim.become(kind, (prop.turn * Math.PI) / 2);
        if (match) sendDisguise(id);
      }
    }
    if (actions.unbecome) {
      actions.unbecome = false;
      if (sim.disguise) {
        sim.become(null);
        if (match) sendDisguise(null);
      }
    }
    if (actions.taunt) {
      actions.taunt = false;
      // In a match only hiders taunt, and the room tells everyone else.
      if (!match || mayDisguise()) {
        const sound = pickTaunt();
        if (sim.taunt(sound) && match) sendTaunt(sound);
      }
    }
    if (actions.decoy) {
      actions.decoy = false;
      // A copy of the prop you are, left where you stand: in a match the room counts and tells everyone.
      if (sim.disguise && (!match || (mayDisguise() && decoysLeft() > 0))) {
        const pl = sim.player;
        if (match) sendDecoy(pl.x, pl.y, pl.z, pl.facing);
        else addLocalDecoy(sim.disguise.id, pl.x, pl.y, pl.z, pl.facing);
        sim.events.push({ type: "decoy" });
      }
    }
    if (actions.lock) {
      actions.lock = false;
      if (sim.disguise) {
        sim.setLocked(!sim.locked);
        play("lock");
      }
    }
    const dt = Math.min(delta, 1 / 20);
    const n = Math.ceil(dt / (1 / 120));
    const frozen = isFrozen();
    if (frozen) input.jumpPressed = false;
    const watching = isSpectating();
    if (watching) watch(sim, dt);
    else {
      if (useHunt.getState().watching !== null) useHunt.setState({ watching: null });
      for (let i = 0; i < n; i++) sim.step(dt / n, frozen ? STILL : input, view.moveYaw);
    }
    // In a match, everyone else sees us through these (unless we're out).
    sendClock.current -= delta;
    if (match && !watching && sendClock.current <= 0) {
      sendClock.current = SEND_EVERY;
      const pl = sim.player;
      sendPosition(pl.x, pl.y, pl.z, pl.facing, poseOf(pl), sim.locked);
    }
    for (const e of sim.events) {
      if (e.type === "jump") play("jump");
      if (e.type === "become") play(e.kind ? "become" : "unbecome");
      if (e.type === "decoy") play("become");
      // Taunt ids are sound names (HUNT_TAUNTS).
      if (e.type === "taunt") play(e.sound as Sound);
      onEvent(e);
    }
    sim.events.length = 0;
    const hud = useHunt.getState();
    const disguise = sim.disguise?.id ?? null;
    const pl = sim.player;
    const area = areaAt(sim.map, pl.x, pl.y + 0.05, pl.z);
    const level = area && OUTSIDE.has(area) ? "outside" : pl.y >= UPSTAIRS - 1 ? "first floor" : "ground floor";
    if (hud.disguise !== disguise || hud.locked !== sim.locked || hud.area !== area || hud.level !== level) {
      useHunt.setState({ disguise, locked: sim.locked, area, level });
    }
  });
  return null;
}

/** Orbits the avatar: mouse turns it, the wheel zooms, walls pull it in. */
export function CameraRig({ sim, view }: { sim: HuntSim; view: View }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const v = useMemo(() => ({ target: new Vector3(), dist: view.distance, ready: false, idle: 0, lastY: 0, climb: 0, sway: 0 }), [view]);

  useEffect(() => {
    camera.fov = CAMERA.fov;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((_, dt) => {
    const pl = sim.player;
    // Steering by hand: the mouse, or the arrow keys.
    const steering = look.dx !== 0 || look.dy !== 0 || lookKeys.x !== 0 || lookKeys.y !== 0;
    view.yaw -= look.dx * CAMERA.sensitivity + lookKeys.x * CAMERA.keyTurn * dt;
    view.pitch = MathUtils.clamp(view.pitch + look.dy * CAMERA.sensitivity + lookKeys.y * CAMERA.keyTilt * dt, CAMERA.minPitch, CAMERA.maxPitch);
    view.distance = MathUtils.clamp(view.distance + look.zoom * 0.6, CAMERA.minDistance, CAMERA.maxDistance);
    look.dx = look.dy = look.zoom = 0;
    // Steering the camera also steers where the keys go.
    if (steering) view.moveYaw = view.yaw;

    // Follow cam: once you've stopped steering a moment, swing round behind wherever you're
    // heading, turning round included (faster the further it has to go; your path is held while
    // the same keys stay down, so it doesn't bend), and tilt to look up or down stairs.
    v.idle = steering ? 0 : v.idle + dt;
    const rise = dt > 0 && v.ready ? (pl.y - v.lastY) / dt : 0;
    v.lastY = pl.y;
    v.climb += ((pl.grounded ? rise : 0) - v.climb) * (1 - Math.exp(-dt * 6));
    const speed = Math.hypot(pl.vx, pl.vz);
    if (v.idle > CAMERA.followDelay && speed > 0.5) {
      const behind = Math.atan2(-pl.vx, -pl.vz);
      const off = angleDelta(view.yaw, behind);
      const turn = CAMERA.followRate * (0.6 + (0.9 * Math.abs(off)) / Math.PI) * Math.min(1, speed / 5.5) * dt;
      view.yaw += MathUtils.clamp(off, -turn, turn);
      const tilt = v.climb > 0.6 ? CAMERA.pitchClimbing : v.climb < -0.6 ? CAMERA.pitchDescending : CAMERA.pitch;
      view.pitch += (tilt - view.pitch) * (1 - Math.exp(-dt * CAMERA.pitchRate));
    }

    // Follow the feet across at once; ease the height, so steps and landings don't jolt. A
    // prop is looked at from just above its top, however tall it is.
    const goalY = pl.y + sim.height + CAMERA.lift - 0.9;
    if (!v.ready) v.target.set(pl.x, goalY, pl.z);
    v.target.x = pl.x;
    v.target.z = pl.z;
    v.target.y += (goalY - v.target.y) * (1 - Math.exp(-dt * 14));

    const cp = Math.cos(view.pitch);
    const dx = Math.sin(view.yaw) * cp;
    const dy = Math.sin(view.pitch);
    const dz = Math.cos(view.yaw) * cp;
    // Stop short of the first wall behind the avatar; snap in, ease back out.
    const reach = view.distance + 0.3;
    const ex = v.target.x + dx * reach;
    const ez = v.target.z + dz * reach;
    const near = sim.collidersIn(Math.min(v.target.x, ex), Math.min(v.target.z, ez), Math.max(v.target.x, ex), Math.max(v.target.z, ez));
    const hit = rayBoxes(near, v.target.x, v.target.y, v.target.z, dx, dy, dz, reach, 0.6);
    const allowed = Math.max(0.4, Math.min(view.distance, hit - 0.3));
    v.dist = allowed < v.dist || !v.ready ? allowed : v.dist + (allowed - v.dist) * (1 - Math.exp(-dt * 5));
    v.ready = true;

    camera.position.set(v.target.x + dx * v.dist, v.target.y + dy * v.dist, v.target.z + dz * v.dist);
    camera.lookAt(v.target);
    // Dizzy (too many misses): the world sways.
    v.sway += ((isDizzy() ? 1 : 0) - v.sway) * (1 - Math.exp(-dt * 3));
    if (v.sway > 0.01) {
      const t = performance.now() / 1000;
      camera.rotateZ(Math.sin(t * 2.6) * 0.22 * v.sway);
      camera.rotateX(Math.sin(t * 1.9) * 0.06 * v.sway);
    }
  });
  return null;
}

/** A taunt's side-to-side shake, fading out as `k` goes 1 → 0. */
export const wiggleAt = (k: number) => Math.sin(k * 30) * 0.22 * k;

/** Mini Characters are 0.67 units tall; this makes them the collider's height (0.9). */
export const CHARACTER_SCALE = 1.35;
const FADE = 0.14;
const ONCE = new Set(["jump"]);

type Pose = HuntPose;

export function poseOf(pl: HuntSim["player"]): Pose {
  if (!pl.grounded) return pl.vy > 0 ? "jump" : "fall";
  const speed = Math.hypot(pl.vx, pl.vz);
  if (speed < 0.5) return "idle";
  return pl.sprinting ? "sprint" : "walk";
}

interface AvatarProps {
  sim: HuntSim;
  subscribe: (l: Listener) => () => void;
}

/** You: your GameHub avatar, animated from the simulation, squashing a little on landing. */
export function Avatar(props: AvatarProps) {
  const config = useAvatar((s) => s.config);
  const { root, animations } = useAvatarModel(config);
  // A rebuilt model (a new look, or a hot reload) gets a fresh animation mixer: the old one
  // would keep animating the previous model's bones, and the legs would stop moving.
  return <AnimatedAvatar key={root.uuid} {...props} scene={root} animations={animations} />;
}

function AnimatedAvatar({ sim, subscribe, scene, animations }: AvatarProps & { scene: Object3D; animations: AnimationClip[] }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const { actions: clips } = useAnimations(animations, body);
  const current = useRef<AnimationAction | null>(null);
  const currentName = useRef("");
  const fx = useRef({ squash: 0, stretch: 0, wiggle: 0, y: sim.player.y });

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }, [scene]);

  useEffect(() => {
    for (const [name, action] of Object.entries(clips)) {
      if (!action) continue;
      action.setLoop(ONCE.has(name) ? LoopOnce : LoopRepeat, Infinity);
      action.clampWhenFinished = ONCE.has(name);
    }
    current.current = null;
    currentName.current = "";
  }, [clips]);

  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === "land") fx.current.squash = Math.min(1, e.speed / 16);
        if (e.type === "jump") fx.current.stretch = 1;
        if (e.type === "respawn") fx.current.y = sim.player.y;
        if (e.type === "taunt") fx.current.wiggle = 1;
      }),
    [subscribe, sim],
  );

  useFrame((_, dt) => {
    const pl = sim.player;
    const g = root.current;
    if (!g) return;
    // While you're a prop, or out of the round, the avatar is put away.
    g.visible = !sim.disguise && !isSpectating();
    if (!g.visible) return;
    animateAccessories(scene, dt);
    const f = fx.current;
    // Stepping up a stair glides instead of popping.
    f.y = pl.grounded && Math.abs(pl.y - f.y) < 1 ? f.y + (pl.y - f.y) * (1 - Math.exp(-dt * 22)) : pl.y;
    g.position.set(pl.x, f.y, pl.z);
    g.rotation.y = MathUtils.lerp(g.rotation.y, g.rotation.y + angleDelta(g.rotation.y, pl.facing), 1 - Math.exp(-dt * 14));

    f.squash = Math.max(0, f.squash - dt * 5);
    f.stretch = Math.max(0, f.stretch - dt * 4);
    const sy = 1 - f.squash * 0.24 + f.stretch * 0.12;
    const sxz = 1 + f.squash * 0.14 - f.stretch * 0.05;
    body.current?.scale.set(CHARACTER_SCALE * sxz, CHARACTER_SCALE * sy, CHARACTER_SCALE * sxz);
    f.wiggle = Math.max(0, f.wiggle - dt * 1.4);
    if (body.current) body.current.rotation.z = wiggleAt(f.wiggle);

    const name = poseOf(pl);
    if (name !== currentName.current) {
      const next = clips[name];
      if (next) {
        current.current?.fadeOut(FADE);
        next.reset().fadeIn(FADE).play();
        current.current = next;
        currentName.current = name;
      }
    }
    if (name === "walk" && current.current) current.current.timeScale = Math.max(0.7, Math.hypot(pl.vx, pl.vz) / 2.6);
  });

  return (
    <group ref={root}>
      <group ref={body} scale={CHARACTER_SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  );
}
