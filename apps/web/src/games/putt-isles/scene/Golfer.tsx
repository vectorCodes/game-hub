// The player's GameHub avatar as the golfer. It stands just behind the ball facing where the
// shot goes, the putter pulling back as a shot is lined up and swinging through when it's
// let go; it walks over
// to wherever the ball stops, cheers a sink and shakes its head when the ball goes out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { LoopOnce, LoopRepeat, MathUtils, Quaternion, Vector3, type AnimationAction, type Group, type Material, type Mesh, type Object3D } from "three";
import { animateAccessories } from "../../../avatar/build";
import { useAvatar } from "../../../avatar/store";
import { useAvatarModel } from "../../../avatar/useAvatarModel";
import { BALL_RADIUS } from "../config";
import { aim, strike, STRIKE_DELAY, view } from "../input";
import { usePutt } from "../store";
import { angleDelta } from "../../sky-climb/ghosts";
import { onPuttEvent, usePuttScene } from "./shared";

/** Mini Characters are 0.67 units tall: this makes the golfer about 0.33 m, a third of a tile. */
const SCALE = 0.5;
/**
 * Where the ball sits relative to the golfer (who faces +z, so its right is -x): a little
 * ahead and off to the right. And where the right hand holds the putter. All scale with the golfer.
 */
const BALL_SIDE = 0.075;
const BALL_AHEAD = 0.05;
const HAND = new Vector3(-0.035, 0.105, 0.04);
/** From the hand down to the ball. */
const HANG = new Vector3(-BALL_SIDE, BALL_RADIUS, BALL_AHEAD).sub(HAND);
/** How solid the golfer is while a shot is lined up, so it never hides the aim line. */
const AIMING_OPACITY = 0.35;
/** The putter's grip and head in the kit model (its own units). */
const CLUB_GRIP = 0.2;
const CLUB_HEAD = -0.769;
const WALK_SPEED = 4.5;
const FADE = 0.15;
const ONCE = new Set(["emote-yes", "emote-no"]);

/** Swing angle (rad) at the top of the backswing, for a shot of `power`. */
const backswing = (power: number) => -(0.12 + power * 0.85);
const followThrough = (power: number) => 0.35 + power * 0.7;

export function Golfer({ kit }: { kit: Record<string, Object3D> }) {
  const { world } = usePuttScene();
  const config = useAvatar((s) => s.config);
  const { root: scene, animations } = useAvatarModel(config);
  const golfer = useRef<Group>(null);
  const body = useRef<Group>(null);
  const swing = useRef<Group>(null);
  const { actions } = useAnimations(animations, body);
  const current = useRef<{ name: string; action: AnimationAction | null }>({ name: "", action: null });
  const st = useRef({ x: 0, z: 0, yaw: 0, placed: false, angle: 0, swingFrom: 0, swingT: -1, swingPower: 0, cheer: 0, sulk: 0 });

  const club = useMemo(() => {
    const c = kit["club-red"].clone(true);
    c.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
    return c;
  }, [kit]);
  // The putter hangs from the hand to the ball.
  const clubScale = HANG.length() / (CLUB_GRIP - CLUB_HEAD);
  const tilt = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), HANG.clone().normalize()), []);

  // Its own see-through materials, to fade while aiming. The model is shared with other
  // pages, so the originals go back when the golfer leaves.
  const faded = useRef<Material[]>([]);
  useEffect(() => {
    const originals = new Map<Mesh, Material | Material[]>();
    const own: Material[] = [];
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      originals.set(mesh, mesh.material);
      const clone = (m: Material) => {
        const c = m.clone();
        c.transparent = true;
        own.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    faded.current = own;
    return () => {
      for (const [mesh, m] of originals) mesh.material = m;
      for (const m of own) m.dispose();
      faded.current = [];
    };
  }, [scene]);

  useEffect(() => {
    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      action.setLoop(ONCE.has(name) ? LoopOnce : LoopRepeat, Infinity);
      action.clampWhenFinished = ONCE.has(name);
    }
    current.current = { name: "", action: null };
  }, [actions]);

  useEffect(
    () =>
      onPuttEvent((e) => {
        const s = st.current;
        if (e.type === "sink") s.cheer = 2;
        if (e.type === "out") s.sulk = 1.6;
      }),
    [],
  );

  const play = (name: string) => {
    const c = current.current;
    if (c.name === name) return;
    const next = actions[name];
    if (!next) return;
    c.action?.fadeOut(FADE);
    next.reset().fadeIn(FADE).play();
    current.current = { name, action: next };
  };

  useFrame((_, dt) => {
    const g = golfer.current;
    if (!g) return;
    animateAccessories(scene, dt);
    const s = st.current;
    const { phase } = usePutt.getState();
    const ball = world.lastRest;

    // Where to stand: just behind the ball and to its left, facing the way the shot goes.
    const facing = aim.active ? aim.yaw : strike.pending ? strike.yaw : phase === "aim" ? view.yaw : s.yaw;
    const cos = Math.cos(facing);
    const sin = Math.sin(facing);
    const spotX = ball.x - (-BALL_SIDE * cos + BALL_AHEAD * sin);
    const spotZ = ball.z - (BALL_SIDE * sin + BALL_AHEAD * cos);
    const ground = ball.y - BALL_RADIUS;

    if (!s.placed) {
      s.x = spotX;
      s.z = spotZ;
      s.yaw = facing;
      s.placed = true;
    }

    // Walk over to the ball once it's stopped (the shot spot doesn't move while it rolls).
    const ready = phase === "aim";
    const dx = spotX - s.x;
    const dz = spotZ - s.z;
    const dist = Math.hypot(dx, dz);
    let walking = false;
    if (ready && dist > 0.04) {
      const step = Math.min(dist, WALK_SPEED * dt * Math.min(1, dist * 2 + 0.3));
      s.x += (dx / dist) * step;
      s.z += (dz / dist) * step;
      walking = dist > 0.15;
      const heading = walking ? Math.atan2(dx, dz) : facing;
      s.yaw += angleDelta(s.yaw, heading) * (1 - Math.exp(-dt * 12));
    } else if (ready) {
      s.yaw += angleDelta(s.yaw, facing) * (1 - Math.exp(-dt * 14));
    }
    g.position.set(s.x, ground, s.z);
    g.rotation.y = s.yaw;

    // The putter: pulled back with the power while aiming, swung through on the strike.
    if (strike.pending && s.swingT < 0) {
      s.swingT = 0;
      s.swingFrom = s.angle;
      s.swingPower = strike.power;
    }
    if (s.swingT >= 0) {
      s.swingT += dt;
      // Reaches the ball (angle 0) at the strike, then follows through and settles.
      const toImpact = s.swingT / STRIKE_DELAY;
      if (toImpact <= 1) s.angle = MathUtils.lerp(s.swingFrom, 0, toImpact * toImpact);
      else {
        const k = Math.min(1, (s.swingT - STRIKE_DELAY) / 0.22);
        s.angle = followThrough(s.swingPower) * Math.sin(k * Math.PI * 0.5);
      }
      if (s.swingT > 1.2) s.swingT = -1;
    } else {
      const goal = aim.active ? backswing(aim.power) : 0;
      s.angle += (goal - s.angle) * (1 - Math.exp(-dt * (aim.active ? 18 : 5)));
    }
    // Back towards the golfer for the backswing, forward along the line to follow through.
    if (swing.current) swing.current.rotation.x = -s.angle;
    club.visible = !walking;

    // See-through while aiming, solid again once the ball's away.
    const goalOpacity = aim.active ? AIMING_OPACITY : 1;
    for (const m of faded.current) {
      m.opacity += (goalOpacity - m.opacity) * (1 - Math.exp(-dt * 10));
      m.depthWrite = m.opacity > 0.95;
    }

    // The body: walking, cheering, sulking, or over the ball holding the putter.
    s.cheer = Math.max(0, s.cheer - dt);
    s.sulk = Math.max(0, s.sulk - dt);
    if (s.cheer > 0) play("emote-yes");
    else if (s.sulk > 0) play("emote-no");
    else if (walking) play(dist > 1.5 ? "sprint" : "walk");
    else play("holding-both");
  });

  return (
    <group ref={golfer}>
      <group ref={body} scale={SCALE}>
        <primitive object={scene} />
      </group>
      {/* The putter: from the hand down to the ball, swinging along the line. */}
      <group ref={swing} position={HAND}>
        <group quaternion={tilt}>
          <group scale={clubScale} position-y={-CLUB_GRIP * clubScale}>
            <primitive object={club} />
          </group>
        </group>
      </group>
    </group>
  );
}
