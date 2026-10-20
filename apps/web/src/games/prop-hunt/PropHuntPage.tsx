// /games/prop-hunt/play: the house. On your own it's a sandbox to explore (Tab flips to an
// overview of the whole property); with friends it's the match: the lobby, then rounds of
// hiding and seeking (?room=K7MPQ joins a room; ?friends=1 opens the make-or-join card).
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { BIG_HOUSE, HOUSE_SCALE, UPSTAIRS, houseFor, newHouseSeed, normalizeRoomCode, shortName } from "@shadow/shared";
import { Object3D, type DirectionalLight, type Group } from "three";
import { useAuth } from "../../auth/store";
import { useAvatar } from "../../avatar/store";
import { isTouch, useControls } from "./input";
import { artColliders } from "./art/colliders";
import { PROP_HUNT_HOME } from "./config";
import { onForcedTaunt, sendLoadout, syncMatch } from "./net";
import { myTaunts, useHuntProgress, useLoadHuntProgress } from "./progress";
import { joinHuntRoom, leaveHuntRoom, roomsAvailable, useHuntRoom } from "./room";
import { HuntSim, type SimEvent } from "./sim";
import { useHunt } from "./store";
import { House } from "./scene/House";
import { Aim, DisguisedSelf } from "./scene/Disguise";
import { Colliders } from "./scene/Colliders";
import { Others } from "./scene/Others";
import { SonarArrow } from "./scene/Sonar";
import { Zaps } from "./scene/Zap";
import { Puffs } from "./scene/Puffs";
import { TauntNotes } from "./scene/Taunt";
import { Hud } from "./ui/Hud";
import { Announcements, Blindfold, Countdown, SeekerBar } from "./ui/Hunt";
import { FriendsCard, Lobby, MatchBanner, RoundCard } from "./ui/Lobby";
import { Avatar, CameraRig, Driver, newView } from "./scene/Play";

/** The middle of the property, where the camera looks first. */
const CENTRE: [number, number, number] = [16 * HOUSE_SCALE, 0, 36 * HOUSE_SCALE];

/** Where the sun sits, relative to what it lights. */
const SUN: [number, number, number] = [40, 60, 45];

/**
 * Rendering quality, best first. Everyone starts sharp (phones one step down) and steps down
 * only if the frame rate can't keep up.
 */
const LEVELS = [
  { dpr: 1.5, ao: "medium", shadowMap: 2048 },
  { dpr: 1.25, ao: "performance", shadowMap: 1024 },
  { dpr: 1, ao: null, shadowMap: 1024 },
] as const;

/**
 * A soft sky and one sun. While you walk, the sun's shadows cover just the area around you
 * (sharper); in the overview they cover the whole property.
 */
function Lights({ sim, follow, shadowMap }: { sim: HuntSim; follow: boolean; shadowMap: number }) {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const reach = follow ? 34 : 100;

  useEffect(() => {
    if (light.current) light.current.target = target;
  }, [target, follow, shadowMap]);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const pl = sim.player;
    // Snapped to the shadow map's texels, so shadows don't shimmer as you walk.
    const texel = (reach * 2) / shadowMap;
    const [x, y, z] = follow ? [Math.round(pl.x / texel) * texel, pl.y, Math.round(pl.z / texel) * texel] : CENTRE;
    target.position.set(x, y, z);
    target.updateMatrixWorld();
    const far = follow ? 1 : 2;
    l.position.set(x + SUN[0] * far, y + SUN[1] * far, z + SUN[2] * far);
  });

  return (
    <>
      <color attach="background" args={["#cfe3f0"]} />
      {/* The sky (Poly Haven, CC0): natural light and reflections everywhere, and the backdrop over the garden. */}
      <Suspense fallback={null}>
        <Environment files="/prop-hunt/hdri/sky.hdr" background backgroundBlurriness={0.03} environmentIntensity={0.6} />
      </Suspense>
      <fog attach="fog" args={["#cfe3f0", 180, 420]} />
      <hemisphereLight args={["#e6eef5", "#8a7a63", 0.55]} />
      <primitive object={target} />
      {/* Keyed: a shadow map can't change size or reach once it's made. */}
      <directionalLight
        key={`${shadowMap}-${reach}`}
        ref={light}
        intensity={2.6}
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-near={1}
        shadow-camera-far={follow ? 200 : 400}
      />
    </>
  );
}

/** Each room's name, floating over it. */
function Labels({ upstairs }: { upstairs: boolean }) {
  return (
    <>
      {BIG_HOUSE.areas
        .filter((a) => upstairs || a.y0 < UPSTAIRS - 1)
        .map((a) => (
          <Html key={a.name} position={[(a.x0 + a.x1) / 2, Math.max(0, a.y0) + 2, (a.z0 + a.z1) / 2]} center zIndexRange={[10, 0]}>
            <span className="pointer-events-none rounded-xs bg-stone-950/80 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] whitespace-nowrap text-stone-100 uppercase">{a.name}</span>
          </Html>
        ))}
    </>
  );
}

type Mode = "walk" | "overview";

export default function PropHuntPage() {
  const [mode, setMode] = useState<Mode>("walk");
  const [upstairs, setUpstairs] = useState(true);
  const [labels, setLabels] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [params, setParams] = useSearchParams();
  const roomParam = normalizeRoomCode(params.get("room") ?? "");
  const synced = useAuth((s) => s.synced);
  const fullName = useAuth((s) => s.user?.user_metadata?.full_name as string | undefined);
  const { code: roomCode, room, you, error: roomError } = useHuntRoom();

  // The props are shuffled every round (the room's seed), and on every visit on your own.
  const [soloSeed] = useState(newHouseSeed);
  const seed = room?.mapSeed ?? soloSeed;
  const map = useMemo(() => houseFor(seed), [seed]);
  const counts = useMemo(() => {
    const disguise = map.props.filter((p) => map.kinds[p.kind].disguise).length;
    return { props: map.props.length, disguise };
  }, [map]);
  const sim = useMemo(() => {
    const s = new HuntSim(BIG_HOUSE);
    s.spawnAt(BIG_HOUSE.hiderSpawns[0], Math.PI);
    return s;
  }, []);
  // Colliders as drawn: model-drawn furniture and props collide as their models' shapes.
  useMemo(() => sim.setMap(map, artColliders(map)), [sim, map]);
  // A new house: whatever was under the crosshair is gone.
  useEffect(() => {
    useHunt.setState({ aimed: null });
  }, [map]);
  const view = useMemo(newView, []);
  // Sim events reach the effects (the avatar's squash) through this.
  const events = useMemo(() => {
    const listeners = new Set<(e: SimEvent) => void>();
    return {
      emit: (e: SimEvent) => listeners.forEach((l) => l(e)),
      subscribe: (l: (e: SimEvent) => void) => {
        listeners.add(l);
        return () => void listeners.delete(l);
      },
    };
  }, []);
  const house = useRef<Group>(null);
  const others = useRef<Group>(null);
  const touch = useMemo(isTouch, []);
  const [level, setLevel] = useState(touch ? 1 : 0);
  const q = LEVELS[level];
  // Never sharper than the screen itself.
  const dpr = Math.min(q.dpr, Math.max(1, window.devicePixelRatio || 1));
  const walking = mode === "walk";

  // Playing with friends: ?room=K7MPQ (a shared link, or the friends card) joins that room once
  // signed-in state is known, so the server sees who we are.
  const [friends, setFriends] = useState(() => params.get("friends") === "1");
  useEffect(() => {
    if (!roomParam || !synced) return;
    joinHuntRoom(roomParam, { name: fullName ? shortName(fullName) : "Guest", avatar: useAvatar.getState().config });
  }, [roomParam, synced, fullName]);
  // Couldn't join (or were put out): drop the link, so a reload doesn't try again.
  useEffect(() => {
    if (roomError) setParams((p) => (p.delete("room"), p), { replace: true });
  }, [roomError, setParams]);
  // Leaving the page leaves the room (a reload doesn't: the server holds the slot a moment).
  useEffect(() => leaveHuntRoom, []);

  const between = !room || room.status === "lobby" || room.status === "results";
  // A match is on: no overview (it would show a seeker the whole house).
  const playing = !between;
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  // Your level and taunts: loaded when you sign in, and told to the room you're in (it plays
  // your taunts for everyone and shows your level).
  useLoadHuntProgress();
  const progress = useHuntProgress((s) => s.progress);
  useEffect(() => {
    if (you) sendLoadout(myTaunts(), progress?.level ?? null);
  }, [you, roomCode, progress]);
  // The room forces a taunt on us in the last minute: we hear and see it too.
  useEffect(() => onForcedTaunt((sound) => sim.tauntNow(sound)), [sim]);
  const showFriends = friends && !roomCode;
  const showLobby = roomCode !== null && between;
  // A card on screen takes the keyboard (typing a code) and the mouse.
  const card = showFriends || showLobby || room?.status === "round";
  useControls(walking && !card, canvas);

  // The match's rules for us (who may disguise) and who else is in view follow the room.
  useEffect(() => syncMatch(room, you), [room, you]);

  // Each round starts everyone at their role's spot: seekers in the garage, hiders spread out.
  const placedRound = useRef(0);
  useEffect(() => {
    if (!room || (room.status !== "countdown" && room.status !== "hide") || placedRound.current === room.round) return;
    const me = room.players.find((p) => p.id === you);
    if (!me?.role) return;
    placedRound.current = room.round;
    if (sim.disguise) sim.become(null);
    const spot = me.role === "seeker" ? map.seekerSpawn : map.hiderSpawns[me.spawn % map.hiderSpawns.length];
    sim.spawnAt(spot, Math.PI);
    view.yaw = 0;
    setMode("walk");
  }, [room, you, sim, view, map]);
  useEffect(() => {
    if (!room || room.status === "lobby") placedRound.current = 0;
  }, [room]);

  // Dev only: C shows every collider over the art.
  const [showColliders, setShowColliders] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyC" && !e.repeat && !(e.target instanceof HTMLInputElement)) setShowColliders((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // Tab flips between walking and the overview.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Tab") return;
      e.preventDefault();
      if (playingRef.current) return;
      setMode((m) => (m === "walk" ? "overview" : "walk"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="fixed inset-0 z-40 touch-none bg-stone-950 select-none">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ fov: 45, near: 0.1, far: 800, position: [CENTRE[0], 55, CENTRE[2] + 70] }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => setCanvas(gl.domElement)}
      >
        {/* Sustained low frame rates step quality down; it never steps back up, so it doesn't flicker. */}
        <PerformanceMonitor
          bounds={(refresh) => (refresh > 90 ? [50, 90] : [45, 60])}
          flipflops={2}
          onDecline={() => setLevel((l) => Math.min(LEVELS.length - 1, l + 1))}
          onFallback={() => setLevel(LEVELS.length - 1)}
        />
        <Lights sim={sim} follow={walking} shadowMap={q.shadowMap} />
        {/* Walking needs every floor: the colliders are there either way. */}
        <House map={map} below={upstairs || walking ? Infinity : UPSTAIRS - 1} groupRef={house} />
        <Driver sim={sim} view={view} onEvent={events.emit} />
        <Suspense fallback={null}>
          <Avatar sim={sim} subscribe={events.subscribe} />
        </Suspense>
        <DisguisedSelf sim={sim} subscribe={events.subscribe} />
        <TauntNotes sim={sim} subscribe={events.subscribe} />
        <Puffs sim={sim} subscribe={events.subscribe} />
        <Others sim={sim} groupRef={others} />
        <Zaps sim={sim} house={house} others={others} />
        <SonarArrow sim={sim} />
        {showColliders && <Colliders sim={sim} />}
        {walking ? (
          <>
            <CameraRig sim={sim} view={view} />
            <Aim sim={sim} house={house} />
          </>
        ) : (
          <>
            {labels && <Labels upstairs={upstairs} />}
            <OrbitControls target={CENTRE} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={3} maxDistance={320} enableDamping />
          </>
        )}
        {q.ao && (
          // Ambient occlusion: soft contact shadows where things meet, so props sit on surfaces
          // instead of floating. The composer draws off-screen, so SMAA does the anti-aliasing.
          <EffectComposer multisampling={0}>
            <N8AO aoRadius={1.4} distanceFalloff={0.8} intensity={2.4} halfRes quality={q.ao} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>

      {walking && !card && <Hud sim={sim} touch={touch} />}
      <MatchBanner />
      <Blindfold />
      <Countdown />
      {walking && <SeekerBar touch={touch} />}
      <Announcements />
      {showFriends && <FriendsCard onBack={() => setFriends(false)} />}
      {showLobby && <Lobby />}
      <RoundCard />

      {/* On phones while walking, only the buttons (the HUD needs the room). */}
      <div
        className={`glass absolute left-4 flex max-w-[calc(100%-2rem)] flex-col gap-3 text-sm text-stone-100 sm:max-w-xs ${touch && walking ? "top-16 p-2" : "top-4 p-4"}`}
      >
        <div className={touch && walking ? "hidden" : ""}>
          <div className="label-mono text-stone-400">Prop Hunt</div>
          <div className="font-display text-lg font-bold">The Big House</div>
          <div className="text-stone-400">
            {counts.props} props, {counts.disguise} you can hide as
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!playing && (
            <button className="rounded-xs bg-stone-100 px-3 py-1.5 text-stone-950" onClick={() => setMode(walking ? "overview" : "walk")}>
              {walking ? "Overview" : "Walk"}
            </button>
          )}
          {!walking && (
            <>
              <button className="rounded-xs px-3 py-1.5 ring-1 ring-stone-100/30" onClick={() => setUpstairs((u) => !u)}>
                {upstairs ? "Lift off the first floor" : "Put the first floor back"}
              </button>
              <button className="rounded-xs px-3 py-1.5 ring-1 ring-stone-100/30" onClick={() => setLabels((l) => !l)}>
                {labels ? "Hide labels" : "Show labels"}
              </button>
            </>
          )}
          {roomsAvailable && !roomCode && (
            <button className="rounded-xs bg-lamp-400 px-3 py-1.5 font-semibold text-ink" onClick={() => setFriends(true)}>
              {touch && walking ? "Friends" : "Play with friends"}
            </button>
          )}
          <Link to={PROP_HUNT_HOME} className="rounded-xs px-3 py-1.5 ring-1 ring-stone-100/30">
            {touch && walking ? "Back" : "Leave"}
          </Link>
        </div>
        {!walking && (
          <div className="text-xs text-stone-400">{touch ? "Drag to orbit · pinch to zoom · two-finger drag to pan" : "Drag to orbit · scroll to zoom · right-drag to pan · Tab to walk"}</div>
        )}
      </div>
    </div>
  );
}
