// The player's GameHub avatar, animated from the simulation: idle, walk, sprint, jump, fall,
// die, and a cheer at checkpoints and on the summit. Plus squash-and-stretch and particle
// bursts (dust on landing, sparkles for coins, confetti at the top).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { LoopOnce, LoopRepeat, MathUtils, type AnimationAction, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { animateAccessories } from "../../../avatar/build";
import { useAvatar } from "../../../avatar/store";
import { preloadAvatar, useAvatarModel } from "../../../avatar/useAvatarModel";
import type { GhostPose } from "@shadow/shared";
import { POWERUPS } from "../config";
import { angleDelta } from "../ghosts";
import { poseOf } from "../sim";
import { useClimb } from "../store";
import { onSimEvent, useSim } from "./shared";

/** Mini Characters are 0.67 units tall; this makes them the physics height (0.9). */
const CHARACTER_SCALE = 1.35;
const FADE = 0.14;
const ONCE = new Set(["jump", "die"]);

/** The animation clip for each pose. */
export const POSE_CLIP: Record<GhostPose, string> = {
  idle: "idle",
  walk: "walk",
  sprint: "sprint",
  jump: "jump",
  fall: "fall",
  die: "die",
  cheer: "emote-yes",
};

export function preloadCharacter() {
  preloadAvatar(useAvatar.getState().config);
}

export function Climber() {
  const sim = useSim();
  const config = useAvatar((s) => s.config);
  const { root: scene, animations } = useAvatarModel(config);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const { actions } = useAnimations(animations, body);
  const current = useRef<AnimationAction | null>(null);
  const currentName = useRef("");
  const fx = useRef({ squash: 0, stretch: 0, cheer: 0 });

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }, [scene]);

  useEffect(() => {
    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      action.setLoop(ONCE.has(name) ? LoopOnce : LoopRepeat, Infinity);
      action.clampWhenFinished = ONCE.has(name);
    }
    current.current = null;
    currentName.current = "";
  }, [actions]);

  useEffect(
    () =>
      onSimEvent((e) => {
        if (e.type === "land") fx.current.squash = Math.min(1, e.speed / 13);
        if (e.type === "jump" || e.type === "airjump" || e.type === "spring") fx.current.stretch = 1;
        if (e.type === "checkpoint") fx.current.cheer = 1.1;
      }),
    [],
  );

  useFrame((_, dt) => {
    const pl = sim.player;
    const g = root.current;
    if (!g) return;
    animateAccessories(scene, dt);
    g.position.set(pl.x, pl.y, pl.z);
    g.rotation.y = MathUtils.lerp(g.rotation.y, g.rotation.y + angleDelta(g.rotation.y, pl.facing), 1 - Math.exp(-dt * 14));

    const f = fx.current;
    f.squash = Math.max(0, f.squash - dt * 5);
    f.stretch = Math.max(0, f.stretch - dt * 4);
    f.cheer = Math.max(0, f.cheer - dt);
    const sy = 1 - f.squash * 0.24 + f.stretch * 0.12;
    const sxz = 1 + f.squash * 0.14 - f.stretch * 0.05;
    body.current?.scale.set(CHARACTER_SCALE * sxz, CHARACTER_SCALE * sy, CHARACTER_SCALE * sxz);

    const speed = Math.hypot(pl.vx, pl.vz);
    const name = POSE_CLIP[poseOf(pl, f.cheer > 0)];

    if (name !== currentName.current) {
      const next = actions[name];
      if (next) {
        current.current?.fadeOut(FADE);
        next.reset().fadeIn(FADE).play();
        current.current = next;
        currentName.current = name;
      }
    }
    if (name === "walk" && current.current) current.current.timeScale = Math.max(0.7, speed / 2.6);
  });

  return (
    <group ref={root}>
      <group ref={body} scale={CHARACTER_SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

const POOL = 60;
const CONFETTI = ["#f8cf72", "#8fc76a", "#ec7a5f", "#7ec8ff", "#d9a6ff", "#ffffff"];

interface Particle {
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  size: number;
}

/** A small pool of particles reused for every burst. */
export function Bursts() {
  const sim = useSim();
  const meshes = useRef<(Mesh | null)[]>([]);
  const particles = useMemo<Particle[]>(
    () => Array.from({ length: POOL }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, size: 0 })),
    [],
  );
  const summitTimer = useRef(0);
  const cursor = useRef(0);

  const spawn = (n: number, color: string | string[], opts: { y?: number; speed: number; up: number; gravity: number; size: number; life: number }) => {
    const pl = sim.player;
    for (let i = 0; i < n; i++) {
      const p = particles[cursor.current];
      const mesh = meshes.current[cursor.current];
      cursor.current = (cursor.current + 1) % POOL;
      const a = Math.random() * Math.PI * 2;
      const s = opts.speed * (0.5 + Math.random() * 0.5);
      Object.assign(p, {
        life: opts.life,
        max: opts.life,
        x: pl.x,
        y: pl.y + (opts.y ?? 0.05),
        z: pl.z,
        vx: Math.cos(a) * s,
        vy: opts.up * (0.6 + Math.random() * 0.6),
        vz: Math.sin(a) * s,
        gravity: opts.gravity,
        size: opts.size * (0.7 + Math.random() * 0.6),
      });
      if (mesh) (mesh.material as MeshBasicMaterial).color.set(Array.isArray(color) ? color[i % color.length] : color);
    }
  };

  useEffect(
    () =>
      onSimEvent((e) => {
        if (e.type === "land" && e.speed > 5) spawn(Math.min(10, Math.round(e.speed / 2)), "#f3eee2", { speed: 2.2, up: 0.6, gravity: 0, size: 0.13, life: 0.45 });
        if (e.type === "jump") spawn(4, "#f3eee2", { speed: 1.2, up: 0.4, gravity: 0, size: 0.1, life: 0.35 });
        if (e.type === "spring") spawn(8, "#f8cf72", { speed: 2.4, up: 1.5, gravity: 4, size: 0.1, life: 0.5 });
        if (e.type === "airjump") spawn(8, "#d9b3ff", { speed: 2.2, up: 0.3, gravity: 0, size: 0.1, life: 0.4 });
        if (e.type === "powerup") spawn(14, POWERUPS[e.kind].color, { y: 0.6, speed: 2.2, up: 3, gravity: 4, size: 0.09, life: 0.7 });
        if (e.type === "shield") spawn(16, ["#9fd0ff", "#ffffff"], { y: 0.5, speed: 3.2, up: 1.5, gravity: 0, size: 0.12, life: 0.55 });
        if (e.type === "coin") spawn(8, "#ffd75e", { y: 0.6, speed: 1.8, up: 2.5, gravity: 6, size: 0.08, life: 0.5 });
        if (e.type === "checkpoint") spawn(16, CONFETTI, { y: 0.4, speed: 2.4, up: 5, gravity: 9, size: 0.09, life: 1.1 });
        if (e.type === "die") spawn(12, "#ffffff", { y: 0.4, speed: 2.6, up: 1.2, gravity: 0, size: 0.16, life: 0.6 });
        if (e.type === "summit") summitTimer.current = 3;
      }),
    [],
  );

  useFrame((_, dt) => {
    // The summit keeps raining confetti for a few seconds.
    if (summitTimer.current > 0) {
      summitTimer.current -= dt;
      if (Math.random() < dt * 14) spawn(3, CONFETTI, { y: 1.2, speed: 3, up: 6, gravity: 7, size: 0.1, life: 1.6 });
    }
    for (let i = 0; i < POOL; i++) {
      const p = particles[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;
      if (p.life <= 0) {
        mesh.visible = false;
        continue;
      }
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.max;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(p.size * (0.4 + t * 0.8));
      (mesh.material as MeshBasicMaterial).opacity = Math.min(1, t * 1.6);
    }
  });

  return (
    <>
      {particles.map((_, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

const TRAIL_POOL = 80;

/** Each trail's look: colour for a particle (t = time), how it drifts, how big. */
const TRAILS: Record<string, { color: (t: number, i: number) => string; rise: number; size: number; rate: number }> = {
  "trail:sparkle": { color: (_, i) => (i % 3 ? "#ffffff" : "#bcd0ff"), rise: 0.4, size: 0.07, rate: 40 },
  "trail:ember": { color: (_, i) => (i % 2 ? "#ffb35c" : "#ec7a5f"), rise: 1.4, size: 0.08, rate: 45 },
  "trail:rainbow": { color: (t) => `hsl(${Math.round((t * 160) % 360)}, 90%, 65%)`, rise: 0.2, size: 0.09, rate: 50 },
  "trail:gold": { color: (_, i) => (i % 2 ? "#ffe08a" : "#f8cf72"), rise: -0.3, size: 0.1, rate: 45 },
};

/** The equipped trail: particles left behind while the climber moves. */
export function Trail() {
  const sim = useSim();
  const meshes = useRef<(Mesh | null)[]>([]);
  const particles = useMemo<Particle[]>(
    () => Array.from({ length: TRAIL_POOL }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, size: 0 })),
    [],
  );
  const cursor = useRef(0);
  const debt = useRef(0);

  useFrame((_, dt) => {
    const style = TRAILS[useClimb.getState().trail];
    const pl = sim.player;
    const moving = Math.hypot(pl.vx, pl.vz) > 1 || !pl.grounded;
    if (style && moving && pl.dead <= 0) {
      debt.current += style.rate * dt;
      while (debt.current >= 1) {
        debt.current -= 1;
        const i = cursor.current;
        cursor.current = (i + 1) % TRAIL_POOL;
        Object.assign(particles[i], {
          life: 0.7,
          max: 0.7,
          x: pl.x + (Math.random() - 0.5) * 0.3,
          y: pl.y + 0.2 + Math.random() * 0.5,
          z: pl.z + (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 0.4,
          vy: style.rise * (0.5 + Math.random()),
          vz: (Math.random() - 0.5) * 0.4,
          gravity: 0,
          size: style.size * (0.6 + Math.random() * 0.8),
        });
        const mesh = meshes.current[i];
        if (mesh) (mesh.material as MeshBasicMaterial).color.set(style.color(sim.t, i));
      }
    }
    for (let i = 0; i < TRAIL_POOL; i++) {
      const p = particles[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;
      if (p.life <= 0) {
        mesh.visible = false;
        continue;
      }
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.max;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y += dt * 4;
      mesh.scale.setScalar(p.size * (0.3 + t));
      (mesh.material as MeshBasicMaterial).opacity = t;
    }
  });

  return (
    <>
      {particles.map((_, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} visible={false}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
