// Becoming a prop: what's under the crosshair (outlined when you can become it), and you, drawn
// as the prop you've become: the very same model and materials as the real one (PropArt).
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Raycaster, Vector3, type Group } from "three";
import { partBox } from "@shadow/shared";
import { AIM } from "../config";
import { angleDelta } from "../math";
import { mayDisguise } from "../net";
import { useHunt } from "../store";
import type { HuntSim, SimEvent } from "../sim";
import { wiggleAt } from "./Play";
import { PropModel } from "./PropArt";

const you = new Vector3();
const forward = new Vector3();
const toProp = new Vector3();

/** Each placed thing to hide as: the middle of the box it fills, and how far that box reaches out. */
function useTargets(map: HuntSim["map"]) {
  return useMemo(() => {
    const out: { id: number; centre: Vector3; radius: number }[] = [];
    for (const p of map.props) {
      const kind = map.kinds[p.kind];
      if (!kind.disguise) continue;
      const boxes = kind.parts.map((part) => partBox(part, p));
      const x0 = Math.min(...boxes.map((b) => b.x0)), x1 = Math.max(...boxes.map((b) => b.x1));
      const y0 = Math.min(...boxes.map((b) => b.y0)), y1 = Math.max(...boxes.map((b) => b.y1));
      const z0 = Math.min(...boxes.map((b) => b.z0)), z1 = Math.max(...boxes.map((b) => b.z1));
      out.push({ id: p.id, centre: new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), radius: Math.max(x1 - x0, y1 - y0, z1 - z0) / 2 });
    }
    return out;
  }, [map]);
}

/**
 * What you're looking at: the thing to hide as nearest the middle of your view (within a cone),
 * within reach of you, and in plain sight (no wall or furniture in front of it). It's outlined,
 * and E becomes it. Checked a few times a second.
 */
export function Aim({ sim, house }: { sim: HuntSim; house: RefObject<Group | null> }) {
  const camera = useThree((s) => s.camera);
  const raycaster = useMemo(() => new Raycaster(), []);
  const targets = useTargets(sim.map);
  const clock = useRef(0);
  const aimed = useHunt((s) => s.aimed);
  useEffect(() => () => useHunt.setState({ aimed: null }), []);

  useFrame((_, dt) => {
    clock.current -= dt;
    if (clock.current > 0) return;
    clock.current = AIM.every;
    const root = house.current;
    if (!root) return;
    // Seekers get no outline: real props lighting up while a disguised hider doesn't would give the hider away.
    if (!mayDisguise()) {
      if (useHunt.getState().aimed !== null) useHunt.setState({ aimed: null });
      return;
    }
    const pl = sim.player;
    you.set(pl.x, pl.y + sim.height / 2, pl.z);
    camera.getWorldDirection(forward);
    const cos = Math.cos(AIM.cone);

    // Within reach and within the cone, best first: nearest the middle of the view, then nearest you.
    const near: { t: (typeof targets)[number]; dist: number; score: number }[] = [];
    for (const t of targets) {
      if (t.centre.distanceTo(you) - t.radius > AIM.reach) continue;
      toProp.subVectors(t.centre, camera.position);
      const dist = toProp.length();
      const along = toProp.dot(forward) / (dist || 1);
      if (along < cos) continue;
      near.push({ t, dist, score: Math.acos(Math.min(1, along)) + t.centre.distanceTo(you) * 0.03 });
    }
    near.sort((a, b) => a.score - b.score);

    // The best one you can actually see: the first thing a ray from the camera meets is it, or nothing nearer.
    const toYou = camera.position.distanceTo(you);
    let next: number | null = null;
    for (const { t, dist } of near.slice(0, 4)) {
      raycaster.set(camera.position, toProp.subVectors(t.centre, camera.position).normalize());
      // Nothing between the camera and you counts (that's behind you, from where you stand).
      raycaster.near = Math.max(0, Math.min(toYou - 0.6, dist - t.radius - 0.1));
      raycaster.far = dist + t.radius;
      const hit = raycaster.intersectObject(root, true)[0];
      const hitProp: number | undefined = hit && hit.instanceId !== undefined ? hit.object.userData.props?.[hit.instanceId] : undefined;
      if (!hit || hitProp === t.id || hit.distance >= dist - t.radius) {
        next = t.id;
        break;
      }
    }
    if (next !== useHunt.getState().aimed) useHunt.setState({ aimed: next });
  });

  if (aimed === null) return null;
  const prop = sim.map.props[aimed];
  const kind = sim.map.kinds[prop.kind];
  return (
    <group position={[prop.x, prop.y, prop.z]} rotation-y={(prop.turn * Math.PI) / 2}>
      <Suspense fallback={null}>
        <PropModel kind={kind} outline={0.04} />
      </Suspense>
    </group>
  );
}

/** You as a prop: follows the simulation, pops in when you change, wobbles when you jump. */
export function DisguisedSelf({ sim, subscribe }: { sim: HuntSim; subscribe: (l: (e: SimEvent) => void) => () => void }) {
  const kindId = useHunt((s) => s.disguise);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const fx = useRef({ pop: 0, squash: 0, stretch: 0, wiggle: 0, y: sim.player.y, yaw: sim.player.facing });

  useEffect(
    () =>
      subscribe((e) => {
        const f = fx.current;
        if (e.type === "become") {
          f.pop = 1;
          f.yaw = sim.player.facing;
        }
        if (e.type === "land") f.squash = Math.min(1, e.speed / 14);
        if (e.type === "jump") f.stretch = 1;
        if (e.type === "respawn") f.y = sim.player.y;
        if (e.type === "taunt") f.wiggle = 1;
      }),
    [subscribe, sim],
  );

  useFrame((_, dt) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const pl = sim.player;
    const f = fx.current;
    f.y = pl.grounded && Math.abs(pl.y - f.y) < 1 ? f.y + (pl.y - f.y) * (1 - Math.exp(-dt * 22)) : pl.y;
    g.position.set(pl.x, f.y, pl.z);
    // Locked props turn not at all; unlocked ones swing round to face where they're going.
    f.yaw = sim.locked ? pl.facing : f.yaw + angleDelta(f.yaw, pl.facing) * (1 - Math.exp(-dt * 12));
    g.rotation.y = f.yaw;

    f.pop = Math.max(0, f.pop - dt * 3.2);
    f.squash = Math.max(0, f.squash - dt * 5);
    f.stretch = Math.max(0, f.stretch - dt * 4);
    // Pop: grows in with a springy overshoot.
    const pop = f.pop > 0 ? 1 + Math.sin(f.pop * Math.PI) * 0.35 - f.pop * 0.3 : 1;
    const sy = pop * (1 - f.squash * 0.3 + f.stretch * 0.18);
    const sxz = pop * (1 + f.squash * 0.18 - f.stretch * 0.08);
    b.scale.set(sxz, sy, sxz);
    // A little tumble in the air: props aren't built for jumping.
    const tilt = pl.grounded ? 0 : Math.sin(sim.player.vy * 0.35) * 0.18;
    b.rotation.x = MathUtils.lerp(b.rotation.x, tilt, 1 - Math.exp(-dt * 10));
    f.wiggle = Math.max(0, f.wiggle - dt * 1.4);
    b.rotation.z = wiggleAt(f.wiggle);
  });

  if (!kindId) return null;
  const kind = sim.map.kinds[kindId];
  return (
    <group ref={root}>
      <group ref={body}>
        <Suspense fallback={null}>
          <PropModel kind={kind} />
        </Suspense>
      </group>
    </group>
  );
}
