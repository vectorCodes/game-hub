// The seekers' zap: a click (or the Zap button) hits whatever is under the crosshair within
// reach. A player under it is a guess at a hider; anything else is a real prop, and a miss.
// The room judges it; we draw the beam at once, and everyone else's zaps as the room reports
// them, with a burst of confetti when one finds a hider.
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CylinderGeometry, MeshBasicMaterial, Raycaster, SphereGeometry, Vector2, Vector3, type Group, type Mesh, type Object3D } from "three";
import { HUNT_ZAP_COOLDOWN_MS, HUNT_ZAP_RANGE } from "@shadow/shared";
import { play } from "../../../lib/sound";
import { actions } from "../input";
import { getRemote, isDizzy, isSeeker, mayZap, onDecoyPopped, sampleRemote, sendZap, type Frame } from "../net";
import { onHuntMessage, useHuntRoom } from "../room";
import type { HuntSim } from "../sim";

const CENTRE = new Vector2(0, 0);
const BEAMS = 6;
const SPARKS = 40;
const BEAM_LIFE = 0.28;
const BEAM_GEOMETRY = new CylinderGeometry(0.05, 0.05, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const SPARK_GEOMETRY = new SphereGeometry(0.08, 8, 6);
const CONFETTI = ["#eec266", "#5bb198", "#e8774f", "#7ec8ff", "#d9a6ff", "#ffffff"];

interface Beam {
  life: number;
  from: Vector3;
  to: Vector3;
  hit: boolean;
}

interface Spark {
  life: number;
  max: number;
  p: Vector3;
  v: Vector3;
}

/** The id a player is known by, from the object the ray hit (or null if it wasn't a player). */
function remoteIdOf(o: Object3D | null): string | null {
  for (let x = o; x; x = x.parent) if (typeof x.userData.remoteId === "string") return x.userData.remoteId;
  return null;
}

export function Zaps({ sim, house, others }: { sim: HuntSim; house: RefObject<Group | null>; others: RefObject<Group | null> }) {
  const camera = useThree((s) => s.camera);
  const { you } = useHuntRoom();
  const raycaster = useMemo(() => new Raycaster(), []);
  const lastZap = useRef(0);
  const beams = useMemo<Beam[]>(() => Array.from({ length: BEAMS }, () => ({ life: 0, from: new Vector3(), to: new Vector3(), hit: false })), []);
  const sparks = useMemo<Spark[]>(() => Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, p: new Vector3(), v: new Vector3() })), []);
  const beamMeshes = useRef<(Mesh | null)[]>([]);
  const sparkMeshes = useRef<(Mesh | null)[]>([]);
  const beamMaterials = useMemo(() => beams.map(() => new MeshBasicMaterial({ color: "#7ef0ff", transparent: true, blending: AdditiveBlending, depthWrite: false })), [beams]);
  const sparkMaterials = useMemo(() => sparks.map(() => new MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false })), [sparks]);
  const cursor = useRef({ beam: 0, spark: 0 });
  const frame = useMemo<Frame>(() => ({ t: 0, x: 0, y: 0, z: 0, facing: 0, pose: "idle", locked: false }), []);

  const fire = (from: Vector3, to: Vector3, hit: boolean) => {
    const k = cursor.current.beam;
    cursor.current.beam = (k + 1) % BEAMS;
    Object.assign(beams[k], { life: BEAM_LIFE, hit });
    beams[k].from.copy(from);
    beams[k].to.copy(to);
    beamMaterials[k].color.set(hit ? "#ffd75e" : "#7ef0ff");
  };

  const burst = (at: Vector3, n: number, colors: string[], speed: number) => {
    for (let i = 0; i < n; i++) {
      const k = cursor.current.spark;
      cursor.current.spark = (k + 1) % SPARKS;
      const s = sparks[k];
      s.life = s.max = 0.6 + Math.random() * 0.6;
      s.p.copy(at);
      s.v.set((Math.random() - 0.5) * speed, Math.random() * speed * 1.2, (Math.random() - 0.5) * speed);
      sparkMaterials[k].color.set(colors[i % colors.length]);
    }
  };

  // Where a player's zap starts: their chest.
  const chestOf = (id: string, out: Vector3): boolean => {
    if (id === you) {
      out.set(sim.player.x, sim.player.y + 0.6, sim.player.z);
      return true;
    }
    const r = getRemote(id);
    if (!r || !sampleRemote(r, performance.now(), frame)) return false;
    out.set(frame.x, frame.y + 0.6, frame.z);
    return true;
  };

  // Everyone else's zaps, and every find (ours too: the room confirms it).
  useEffect(
    () =>
      onHuntMessage((msg) => {
        if (msg.type !== "zapped") return;
        const to = new Vector3(...msg.at);
        if (msg.hit) {
          burst(to, 24, CONFETTI, 5);
          play("zapHit");
        }
        if (msg.by === you) return;
        const from = new Vector3();
        if (chestOf(msg.by, from)) fire(from, to, msg.hit);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [you],
  );

  // A zapped decoy bursts into grey fluff (with a boing) for everyone.
  useEffect(
    () =>
      onDecoyPopped((at) => {
        burst(new Vector3(at[0], at[1] + 0.4, at[2]), 18, ["#d6d3d1", "#a8a29e", "#ffffff"], 3.5);
        play("boing");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, dt) => {
    // Our own zap: at once on screen, and off to the room to judge.
    if (actions.zap) {
      actions.zap = false;
      const now = performance.now();
      if (mayZap() && !isDizzy() && now - lastZap.current >= HUNT_ZAP_COOLDOWN_MS && house.current) {
        const me = new Vector3(sim.player.x, sim.player.y + sim.height / 2, sim.player.z);
        raycaster.setFromCamera(CENTRE, camera);
        const toYou = camera.position.distanceTo(me);
        raycaster.near = Math.max(0, toYou - 0.6);
        raycaster.far = toYou + HUNT_ZAP_RANGE + 1;
        const targets: Object3D[] = [house.current];
        if (others.current) targets.push(others.current);
        const hit = raycaster.intersectObjects(targets, true).find((h) => h.point.distanceTo(me) <= HUNT_ZAP_RANGE);
        if (hit) {
          const target = remoteIdOf(hit.object);
          // A fellow seeker isn't worth a zap (or the HP it costs).
          if (!(target && isSeeker(target))) {
            lastZap.current = now;
            const from = new Vector3(sim.player.x, sim.player.y + 0.6, sim.player.z);
            fire(from, hit.point, false);
            burst(hit.point, 6, ["#7ef0ff", "#ffffff"], 2);
            play("zap");
            sendZap(target, [hit.point.x, hit.point.y, hit.point.z]);
          }
        }
      }
    }

    for (let i = 0; i < BEAMS; i++) {
      const b = beams[i];
      const mesh = beamMeshes.current[i];
      if (!mesh) continue;
      b.life = Math.max(0, b.life - dt);
      mesh.visible = b.life > 0;
      if (!mesh.visible) continue;
      const length = b.from.distanceTo(b.to);
      mesh.position.copy(b.from);
      mesh.lookAt(b.to);
      mesh.scale.set(1 + (1 - b.life / BEAM_LIFE), 1 + (1 - b.life / BEAM_LIFE), length);
      beamMaterials[i].opacity = b.life / BEAM_LIFE;
    }
    for (let i = 0; i < SPARKS; i++) {
      const s = sparks[i];
      const mesh = sparkMeshes.current[i];
      if (!mesh) continue;
      s.life = Math.max(0, s.life - dt);
      mesh.visible = s.life > 0;
      if (!mesh.visible) continue;
      s.v.y -= 9 * dt;
      s.p.addScaledVector(s.v, dt);
      mesh.position.copy(s.p);
      sparkMaterials[i].opacity = s.life / s.max;
    }
  });

  return (
    <>
      {beams.map((_, i) => (
        <mesh key={`b${i}`} ref={(m) => void (beamMeshes.current[i] = m)} geometry={BEAM_GEOMETRY} material={beamMaterials[i]} visible={false} raycast={() => {}} />
      ))}
      {sparks.map((_, i) => (
        <mesh key={`s${i}`} ref={(m) => void (sparkMeshes.current[i] = m)} geometry={SPARK_GEOMETRY} material={sparkMaterials[i]} visible={false} raycast={() => {}} />
      ))}
    </>
  );
}
