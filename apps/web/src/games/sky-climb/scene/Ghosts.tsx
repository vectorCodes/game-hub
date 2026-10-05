// Other climbers on the tower: ghosts (replays of finished climbs, translucent) and live
// climbers (players on today's tower right now), each wearing their own avatar.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useAnimations } from "@react-three/drei";
import { LoopOnce, LoopRepeat, MathUtils, type AnimationAction, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { DEFAULT_AVATAR, type AvatarConfig, type GhostFrame } from "@shadow/shared";
import { animateAccessories } from "../../../avatar/build";
import { useAvatarModel } from "../../../avatar/useAvatarModel";
import { angleDelta, playClock, riderMarks, sampleGhost, type RiderKind } from "../ghosts";
import { LIVE_MAX, sampleLive, useLiveRiders } from "../live";
import { floorAt } from "../tower";
import { useClimb } from "../store";
import { POSE_CLIP } from "./Climber";
import { useSim } from "./shared";

const CHARACTER_SCALE = 1.35;
const FADE = 0.14;
const ONCE = new Set(["jump", "die"]);

const LOOK: Record<RiderKind, { opacity: number; glow: string | null; label: string }> = {
  me: { opacity: 0.4, glow: "#f8cf72", label: "bg-lamp-300/90 text-ink" },
  ghost: { opacity: 0.4, glow: "#9fc4ff", label: "bg-sky-300/85 text-stone-950" },
  challenge: { opacity: 0.5, glow: "#ff8fa3", label: "bg-rose-400/90 text-stone-950" },
  live: { opacity: 0.9, glow: null, label: "bg-moss-400/90 text-stone-950" },
};

interface RiderProps {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  kind: RiderKind;
  /** Fills in where the rider is now; false hides them. */
  sample: (out: GhostFrame) => boolean;
}

function Rider({ id, name, avatar, kind, sample }: RiderProps) {
  const sim = useSim();
  const { root: scene, animations } = useAvatarModel(avatar ?? DEFAULT_AVATAR);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const { actions } = useAnimations(animations, body);
  const current = useRef<{ action: AnimationAction | null; name: string }>({ action: null, name: "" });
  const frame = useRef<GhostFrame>({ x: 0, y: 0, z: 0, facing: 0, pose: "idle" });
  const look = LOOK[kind];

  // Its own see-through materials, so the player's own avatar stays solid.
  const materials = useMemo(() => {
    const out: MeshStandardMaterial[] = [];
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as MeshStandardMaterial).clone();
      m.transparent = look.opacity < 1;
      m.opacity = look.opacity;
      m.depthWrite = look.opacity >= 1;
      if (look.glow && m.emissive) {
        m.emissive.set(look.glow);
        m.emissiveIntensity = 0.35;
      }
      mesh.material = m;
      mesh.castShadow = kind === "live";
      out.push(m);
    });
    return out;
  }, [scene, look, kind]);

  useEffect(() => {
    for (const [clip, action] of Object.entries(actions)) {
      if (!action) continue;
      action.setLoop(ONCE.has(clip) ? LoopOnce : LoopRepeat, Infinity);
      action.clampWhenFinished = ONCE.has(clip);
    }
    current.current = { action: null, name: "" };
  }, [actions]);

  useEffect(() => () => void riderMarks.delete(id), [id]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const f = frame.current;
    const shown = sample(f);
    g.visible = shown;
    if (!shown) {
      riderMarks.delete(id);
      return;
    }
    animateAccessories(scene, dt);
    const first = g.position.lengthSq() === 0;
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = first ? f.facing : MathUtils.lerp(g.rotation.y, g.rotation.y + angleDelta(g.rotation.y, f.facing), 1 - Math.exp(-dt * 14));

    // Fade out when right on top of the player, so they never hide your own climber.
    const pl = sim.player;
    const near = MathUtils.clamp(Math.hypot(f.x - pl.x, f.y - pl.y, f.z - pl.z) / 1.6, 0.25, 1);
    for (const m of materials) m.opacity = look.opacity * near;

    const clip = POSE_CLIP[f.pose];
    if (clip !== current.current.name) {
      const next = actions[clip];
      if (next) {
        current.current.action?.fadeOut(FADE);
        next.reset().fadeIn(FADE).play();
        current.current = { action: next, name: clip };
      }
    }
    riderMarks.set(id, { id, name, kind, floor: floorAt(sim.tower, f.y) });
  });

  return (
    <group ref={root}>
      <group ref={body} scale={CHARACTER_SCALE}>
        <primitive object={scene} />
      </group>
      <Html position={[0, 1.3, 0]} center distanceFactor={9} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow ${look.label}`}>
          {kind === "live" ? "● " : kind === "challenge" ? "⚔ " : "👻 "}
          {name}
        </span>
      </Html>
    </group>
  );
}

export function Ghosts() {
  const ghosts = useClimb((s) => s.ghosts);
  const live = useLiveRiders();
  const phase = useClimb((s) => s.phase);
  const sim = useSim();
  if (phase !== "playing" && phase !== "summit") return null;

  return (
    <>
      {ghosts.map((g) => (
        <Suspense key={`ghost-${g.id}`} fallback={null}>
          <Rider
            id={`ghost-${g.id}`}
            name={g.name}
            avatar={g.avatar}
            kind={g.challenge ? "challenge" : g.isMe ? "me" : "ghost"}
            sample={(out) => {
              sampleGhost(g.frames, playClock.t, out);
              return true;
            }}
          />
        </Suspense>
      ))}
      {live
        .slice()
        .sort((a, b) => distance(a, sim.player.y) - distance(b, sim.player.y))
        .slice(0, LIVE_MAX)
        .map((r) => (
          <Suspense key={`live-${r.id}`} fallback={null}>
            <Rider id={`live-${r.id}`} name={r.name} avatar={r.avatar} kind="live" sample={(out) => sampleLive(r, out)} />
          </Suspense>
        ))}
    </>
  );
}

/** How far a live climber is from the player's height (nearest are drawn first). */
function distance(r: { buffer: { frame: GhostFrame }[] }, y: number) {
  const last = r.buffer[r.buffer.length - 1];
  return last ? Math.abs(last.frame.y - y) : Infinity;
}
