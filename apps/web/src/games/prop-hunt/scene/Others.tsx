// Everyone else in the match: as their avatar (walking, running, jumping as they do) or as the
// prop they've become, drawn a moment behind and blended so they move smoothly. Their taunts
// come from where they are, louder the closer they are. Disguised players are solid, like the
// real props: walking through a "mug" mustn't give a hider away.
import { Suspense, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useAnimations } from "@react-three/drei";
import { LoopOnce, LoopRepeat, Vector3, type AnimationAction, type AnimationClip, type Group, type Mesh, type Object3D } from "three";
import { DEFAULT_AVATAR, kindBounds, type AvatarConfig, type Collider, type HuntPlayerView } from "@shadow/shared";
import { animateAccessories } from "../../../avatar/build";
import { useAvatarModel } from "../../../avatar/useAvatarModel";
import { play, type Sound } from "../../../lib/sound";
import { angleDelta } from "../math";
import { allRemotes, getRemote, isExposed, onRemoteTaunt, pruneRemotes, sampleRemote, useRemoteIds, type Frame } from "../net";
import { useHuntRoom } from "../room";
import type { HuntSim } from "../sim";
import { PropModel } from "./PropArt";
import { CHARACTER_SCALE, wiggleAt } from "./Play";
import { burstNotes, NoteAnchor } from "./Taunt";

const TAUNTS: Sound[] = ["squeak", "honk", "boing", "whistle"];
/** Taunts fade to nothing over this distance (but never quite: you always hear something). */
const HEARING = 45;
const FADE = 0.14;

const newFrame = (): Frame => ({ t: 0, x: 0, y: 0, z: 0, facing: 0, pose: "idle", locked: false });

/**
 * `groupRef` holds every other player, for the seekers' zaps to raycast: each player's group
 * carries `userData.remoteId`, the id the room knows them by (to us).
 */
export function Others({ sim, groupRef }: { sim: HuntSim; groupRef?: Ref<Group> }) {
  const ids = useRemoteIds();
  const { room, you } = useHuntRoom();
  const roster = useMemo(() => new Map((room?.players ?? []).map((p) => [p.id, p])), [room]);
  const viewerHides = roster.get(you ?? "")?.role === "hider" && !roster.get(you ?? "")?.found;
  return (
    <>
      <MovingColliders sim={sim} />
      <group ref={groupRef}>
        {ids.map((id) => (
          <RemotePlayer key={id} id={id} sim={sim} player={roster.get(id)} viewerHides={viewerHides} />
        ))}
      </group>
    </>
  );
}

/** Each frame: drops players gone quiet, and makes the disguised ones solid for us. */
function MovingColliders({ sim }: { sim: HuntSim }) {
  const frame = useMemo(newFrame, []);
  const bounds = useMemo(() => new Map<string, ReturnType<typeof kindBounds>>(), []);
  useFrame(() => {
    const now = performance.now();
    pruneRemotes(now);
    const moving: Collider[] = [];
    for (const r of allRemotes()) {
      if (!r.kind || !sampleRemote(r, now, frame)) continue;
      const kind = sim.map.kinds[r.kind];
      if (!kind) continue;
      let b = bounds.get(r.kind);
      if (!b) bounds.set(r.kind, (b = kindBounds(kind)));
      const half = Math.max(b.w, b.d) / 2;
      moving.push({ x0: frame.x - half, x1: frame.x + half, z0: frame.z - half, z1: frame.z + half, y0: frame.y, y1: frame.y + b.h, step: false });
    }
    sim.setMoving(moving);
  });
  useEffect(() => () => sim.setMoving([]), [sim]);
  return null;
}

const right = new Vector3();

function RemotePlayer({ id, sim, player, viewerHides }: { id: string; sim: HuntSim; player: HuntPlayerView | undefined; viewerHides: boolean }) {
  const camera = useThree((s) => s.camera);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const notes = useRef<HTMLDivElement>(null);
  const frame = useMemo(newFrame, []);
  const fx = useRef({ yaw: 0, wiggle: 0, ready: false });
  const [kind, setKind] = useState<string | null>(() => getRemote(id)?.kind ?? null);
  const glow = useRef<Mesh>(null);

  useEffect(
    () =>
      onRemoteTaunt((who, sound) => {
        if (who !== id) return;
        fx.current.wiggle = 1;
        if (notes.current) burstNotes(notes.current, sound);
        // From where they are: quieter with distance, and to the side they're on.
        const pl = sim.player;
        const dx = frame.x - pl.x;
        const dz = frame.z - pl.z;
        const d = Math.hypot(dx, frame.y - pl.y, dz);
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const pan = d > 0.5 ? (right.x * dx + right.z * dz) / Math.hypot(dx, dz) : 0;
        play(TAUNTS[sound], 1, { volume: Math.max(0.12, 1 - d / HEARING), pan: pan * 0.8 });
      }),
    [id, sim, camera, frame],
  );

  useFrame((_, dt) => {
    const r = getRemote(id);
    const g = root.current;
    if (!r || !g) return;
    if (r.kind !== kind) setKind(r.kind);
    if (!sampleRemote(r, performance.now(), frame)) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(frame.x, frame.y, frame.z);
    const f = fx.current;
    // Locked props hold their facing exactly; everything else turns smoothly.
    f.yaw = !f.ready || frame.locked ? frame.facing : f.yaw + angleDelta(f.yaw, frame.facing) * (1 - Math.exp(-dt * 14));
    f.ready = true;
    g.rotation.y = f.yaw;
    f.wiggle = Math.max(0, f.wiggle - dt * 1.4);
    if (body.current) body.current.rotation.z = wiggleAt(f.wiggle);
    // Caught undisguised when the seekers came out: a pulsing ring for everyone to see.
    if (glow.current) {
      glow.current.visible = isExposed(id);
      glow.current.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.12);
    }
  });

  const propKind = kind ? sim.map.kinds[kind] : null;
  // Name tags: everyone's avatar; a disguised player's only to their fellow hiders.
  const name = player?.name;
  const tag = name && (!propKind || viewerHides) ? name : null;
  return (
    <group ref={root} userData={{ remoteId: id }}>
      <mesh ref={glow} rotation-x={-Math.PI / 2} position-y={0.05} visible={false} raycast={() => {}}>
        <ringGeometry args={[0.7, 0.95, 32]} />
        <meshBasicMaterial color="#e8774f" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {propKind ? (
          <Suspense fallback={null}>
            <PropModel kind={propKind} />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <RemoteAvatar config={player?.avatar ?? DEFAULT_AVATAR} frame={frame} />
          </Suspense>
        )}
      </group>
      <group position-y={(propKind ? kindBounds(propKind).h : 0.9) + 0.35}>
        <NoteAnchor box={notes} />
        {tag && (
          <Html center zIndexRange={[15, 0]}>
            <span className="pointer-events-none rounded-full bg-stone-950/75 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-stone-100">{tag}</span>
          </Html>
        )}
      </group>
    </group>
  );
}

function RemoteAvatar({ config, frame }: { config: AvatarConfig; frame: Frame }) {
  const { root, animations } = useAvatarModel(config);
  // A rebuilt model gets a fresh mixer (see Avatar in Play.tsx).
  return <RemoteAvatarRig key={root.uuid} scene={root} animations={animations} frame={frame} />;
}

function RemoteAvatarRig({ scene, animations, frame }: { scene: Object3D; animations: AnimationClip[]; frame: Frame }) {
  const body = useRef<Group>(null);
  const { actions } = useAnimations(animations, body);
  const current = useRef<AnimationAction | null>(null);
  const currentName = useRef("");

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }, [scene]);

  useEffect(() => {
    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      action.setLoop(name === "jump" ? LoopOnce : LoopRepeat, Infinity);
      action.clampWhenFinished = name === "jump";
    }
  }, [actions]);

  useFrame((_, dt) => {
    animateAccessories(scene, dt);
    const name = frame.pose;
    if (name === currentName.current) return;
    const next = actions[name];
    if (!next) return;
    current.current?.fadeOut(FADE);
    next.reset().fadeIn(FADE).play();
    current.current = next;
    currentName.current = name;
  });

  return (
    <group ref={body} scale={CHARACTER_SCALE}>
      <primitive object={scene} />
    </group>
  );
}
