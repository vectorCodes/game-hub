// Sky Climb's 3D scene. Lazy-loaded with the play page so three.js stays off the hub.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Vector3, type PerspectiveCamera } from "three";
import { play } from "../../../lib/sound";
import { detectWeakDevice } from "../../../pages/landing/world/quality";
import { footstep, startAmbience, stopAmbience, surfaceOf, updateAmbience } from "../ambience";
import { zoneIndexOf, ZONES } from "../config";
import { frameOf, record, recordCheer } from "../ghosts";
import { input } from "../input";
import { LIVE_SEND_EVERY, sendLive } from "../live";
import { Sim } from "../sim";
import { useClimb } from "../store";
import { generateTower } from "../tower";
import { Bursts, Climber, preloadCharacter, Trail } from "./Climber";
import { Clouds, Island, SkyAndLight, Stars, Weather } from "./Environment";
import { Ghosts } from "./Ghosts";
import { emitSimEvent, preloadKit, SimContext, useSim } from "./shared";
import { Coins, Core, Hazards, Platforms } from "./TowerView";

preloadKit();
preloadCharacter();

/** Steps the simulation and turns its events into sounds, HUD updates and effects. */
function Driver() {
  const sim = useSim();
  const steps = useRef({ walked: 0, ambience: 0, live: 0 });
  useEffect(() => stopAmbience, []);

  useFrame((_, raw) => {
    // Long frames (a background tab) are capped so nobody tunnels through a platform.
    const dt = Math.min(raw, 1 / 30);
    const store = useClimb.getState();
    if (store.phase === "playing") {
      sim.step(dt / 2, input);
      sim.step(dt / 2, input);
    } else {
      sim.idle(dt);
    }

    // The ghost recording, and this climber's position for anyone watching live.
    const pl = sim.player;
    const s = steps.current;
    if (store.phase === "playing" || store.phase === "summit") {
      record(dt, pl);
      s.live -= dt;
      if (s.live <= 0) {
        s.live = LIVE_SEND_EVERY;
        sendLive(frameOf(pl));
      }
    }

    // Sound: the soundscape starts with the first climb (after a click, so audio may play).
    if (store.phase === "playing") startAmbience();
    s.ambience -= dt;
    if (s.ambience <= 0) {
      s.ambience = 0.15;
      updateAmbience(pl.height, sim.gust, zoneIndexOf(Math.floor(pl.height)));
    }
    // Own speed only: riding a moving platform or a conveyor makes no footsteps.
    if (store.phase === "playing" && pl.grounded) {
      s.walked += Math.hypot(pl.vx, pl.vz) * dt;
      if (s.walked > 0.9) {
        s.walked = 0;
        footstep(surfaceOf(pl.ground?.p.piece));
      }
    }

    for (const e of sim.events) {
      emitSimEvent(e, sim);
      switch (e.type) {
        case "land":
          if (e.speed > 3) footstep(surfaceOf(pl.ground?.p.piece), true);
          break;
        case "jump":
          play("jump");
          break;
        case "spring":
          play("spring");
          break;
        case "coin":
          play("coin");
          store.addCoin();
          break;
        case "die":
          play("fall");
          store.addFall();
          break;
        case "floor": {
          const before = zoneIndexOf(store.floor);
          store.reachFloor(e.floor);
          const zone = zoneIndexOf(e.floor);
          if (zone > before && ZONES[zone].id !== "summit") {
            store.showToast({ title: `${ZONES[zone].emoji} ${ZONES[zone].name}`, subtitle: ZONES[zone].blurb, tone: "zone" });
          }
          break;
        }
        case "checkpoint":
          play("checkpoint");
          recordCheer();
          store.reachCheckpoint(e.floor);
          store.showToast({ title: "Checkpoint", subtitle: `Floor ${e.floor} · you'll restart here`, tone: "checkpoint" });
          break;
        case "summit":
          play("win");
          store.summit();
          break;
      }
    }
    sim.events.length = 0;
    const windy = sim.gust > 0.5;
    if (windy !== store.windy) useClimb.setState({ windy });
  });
  return null;
}

/**
 * Looks in at the column from outside the spiral, a little above the climber, so moving
 * left and right runs round the tower. Wider and further back on portrait phones.
 */
function CameraRig() {
  const sim = useSim();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const v = useMemo(() => ({ goal: new Vector3(), look: new Vector3(), lookGoal: new Vector3(), ready: false }), []);

  useFrame((_, dt) => {
    const pl = sim.player;
    const menu = useClimb.getState().phase === "menu";
    const portrait = aspect < 0.9;
    const fov = portrait ? 62 : 50;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const r = Math.hypot(pl.x, pl.z) || 1;
    const back = menu ? 5.5 : portrait ? 10.5 : 8.5;
    const up = menu ? 1.4 : portrait ? 4.4 : 3.3;
    // In the menu, swing round a little to see the character's face.
    const swing = menu ? 0.35 : 0;
    const a = Math.atan2(pl.z, pl.x) + swing;
    v.goal.set(Math.cos(a) * (r + back), pl.y + up, Math.sin(a) * (r + back));
    v.lookGoal.set(pl.x, pl.y + (menu ? 0.7 : 0.9), pl.z);

    const k = v.ready ? 1 - Math.exp(-dt * 4.5) : 1;
    v.ready = true;
    camera.position.lerp(v.goal, k);
    v.look.lerp(v.lookGoal, k);
    camera.lookAt(v.look);
  });
  return null;
}

export default function Game() {
  const seed = useClimb((s) => s.seed);
  const attempt = useClimb((s) => s.attempt);
  const tower = useMemo(() => generateTower(seed), [seed]);
  // A fresh simulation per attempt: retrying the same tower starts from the bottom.
  const sim = useMemo(() => new Sim(tower), [tower, attempt]);
  const weak = useMemo(detectWeakDevice, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={weak ? 1 : [1, 1.75]}
        camera={{ fov: 50, near: 0.1, far: 600, position: [12, 3, 0] }}
        gl={{ antialias: !weak, powerPreference: "high-performance" }}
      >
        <SimContext value={sim}>
          <Driver />
          <SkyAndLight weak={weak} />
          <Stars />
          <Weather weak={weak} />
          <CameraRig />
          <Suspense fallback={null}>
            <Clouds tower={tower} />
            <Island />
            <Core tower={tower} />
            <Platforms />
            <Hazards />
            <Coins />
          </Suspense>
          <Ghosts />
          {/* Its own boundary: switching climbers mustn't blank the tower while one loads. */}
          <Suspense fallback={null}>
            <Climber />
          </Suspense>
          <Bursts />
          <Trail />
          {!weak && (
            <EffectComposer multisampling={4}>
              <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
              <Vignette offset={0.3} darkness={0.55} />
            </EffectComposer>
          )}
        </SimContext>
      </Canvas>
    </div>
  );
}
