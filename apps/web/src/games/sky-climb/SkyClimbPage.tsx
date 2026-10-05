// /games/sky-climb/play: the 3D climb with its HUD, start menu and results.
import { lazy, Suspense, useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useSearchParams } from "react-router";
import { shortName } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { useAvatar } from "../../avatar/store";
import { useKeyboard } from "./input";
import { joinLive, leaveLive } from "./live";
import { useClimb } from "./store";
import { Hud } from "./ui/Hud";
import { Locker } from "./ui/Locker";
import { Menu, Results } from "./ui/Panels";

const Game = lazy(() => import("./scene/Game"));

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-stone-950">
      <div className="text-center">
        <div className="font-display text-2xl font-semibold">Building the tower…</div>
        <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-lamp-300 to-lamp-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function SkyClimbPage() {
  const phase = useClimb((s) => s.phase);
  const loadDaily = useClimb((s) => s.loadDaily);
  const loadProfile = useClimb((s) => s.loadProfile);
  const userId = useAuth((s) => s.user?.id);
  const synced = useAuth((s) => s.synced);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const playing = phase === "playing";
  const [params] = useSearchParams();
  const challengeId = params.get("challenge");
  const loadChallenge = useClimb((s) => s.loadChallenge);
  const mode = useClimb((s) => s.mode);
  const seed = useClimb((s) => s.seed);
  const showLive = useClimb((s) => s.showLive);
  const avatar = useAvatar((s) => s.config);
  const fullName = useAuth((s) => s.user?.user_metadata?.full_name as string | undefined);

  useKeyboard(playing);

  // A challenge link: "beat my climb" opens the challenger's tower with their ghost.
  useEffect(() => {
    if (challengeId && synced) void loadChallenge(challengeId);
  }, [challengeId, synced, loadChallenge]);

  // Live climbs: on today's tower, see (and be seen by) everyone climbing it right now.
  const live = showLive && mode === "daily" && (playing || phase === "summit");
  useEffect(() => {
    if (!live) return;
    joinLive(seed, { name: fullName ? shortName(fullName) : "Guest", avatar });
    return leaveLive;
  }, [live, seed, fullName, avatar]);

  // Today's leaderboard and the locker, refreshed when the player signs in or out.
  useEffect(() => {
    if (!synced) return;
    void loadDaily();
    void loadProfile();
  }, [synced, userId, loadDaily, loadProfile]);

  // Save progress if the tab is hidden or closed mid-climb; leaving the page ends the run.
  useEffect(() => {
    const save = () => document.visibilityState === "hidden" && useClimb.getState().report(true);
    document.addEventListener("visibilitychange", save);
    return () => {
      document.removeEventListener("visibilitychange", save);
      const { phase: p, finish } = useClimb.getState();
      if (p === "playing" || p === "summit") void finish();
      useClimb.getState().clearChallenge();
      useClimb.getState().backToMenu();
    };
  }, []);

  return (
    <div className="relative h-[calc(100dvh-4rem)] touch-none overflow-hidden bg-stone-950 select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Loader />
      {(playing || phase === "summit") && <Hud touch={touch} />}
      {(phase === "menu" || phase === "starting") && <Menu />}
      {phase === "over" && <Results />}
      <Locker />
    </div>
  );
}
