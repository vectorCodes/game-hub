// /games/sky-climb/play: the 3D climb with its HUD, start menu and results.
import { lazy, Suspense, useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useSearchParams } from "react-router";
import { normalizeRoomCode, shortName } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { useAvatar } from "../../avatar/store";
import { useKeyboard } from "./input";
import { joinLive, leaveLive } from "./live";
import { joinRoom, leaveRoom, toLocalTime, useRoom } from "./room";
import { useClimb } from "./store";
import { Hud } from "./ui/Hud";
import { Lobby } from "./ui/Lobby";
import { Locker } from "./ui/Locker";
import { Menu, Results } from "./ui/Panels";
import { RaceCountdown, RaceResults } from "./ui/Race";

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
  const [params, setParams] = useSearchParams();
  const challengeId = params.get("challenge");
  const loadChallenge = useClimb((s) => s.loadChallenge);
  const mode = useClimb((s) => s.mode);
  const seed = useClimb((s) => s.seed);
  const showLive = useClimb((s) => s.showLive);
  const avatar = useAvatar((s) => s.config);
  const fullName = useAuth((s) => s.user?.user_metadata?.full_name as string | undefined);
  const roomParam = normalizeRoomCode(params.get("room") ?? "");
  const { code: roomCode, error: roomError, room } = useRoom();
  const race = useClimb((s) => s.race);

  useKeyboard(playing);

  // A challenge link: "beat my climb" opens the challenger's tower with their ghost.
  useEffect(() => {
    if (challengeId && synced) void loadChallenge(challengeId);
  }, [challengeId, synced, loadChallenge]);

  // A room (?room=K7MPQ, from a shared link or the friends card): join it once signed-in
  // state is known, so the server sees who we are.
  useEffect(() => {
    if (!roomParam || !synced) return;
    const { config } = useAvatar.getState();
    joinRoom(roomParam, { name: fullName ? shortName(fullName) : "Guest", avatar: config });
  }, [roomParam, synced, fullName]);

  // Couldn't join (or were put out): drop the link, so a reload doesn't try again.
  useEffect(() => {
    if (roomError) setParams((p) => (p.delete("room"), p), { replace: true });
  }, [roomError, setParams]);

  // Leaving the page leaves the room (a reload doesn't: the server holds the slot a moment).
  useEffect(() => leaveRoom, []);

  // The room says when to race: its countdown builds the tower here too, the end of the
  // race stops whoever is still climbing, and a rematch brings everyone back to the lobby.
  useEffect(() => {
    const climb = useClimb.getState();
    if (!roomCode || !room) {
      if (!roomCode) climb.leaveRace();
      return;
    }
    const { status, seed, startAt, endsAt } = room;
    if ((status === "countdown" || status === "racing") && seed && startAt && endsAt) {
      if (climb.race?.seed !== seed) climb.startRace({ seed, startAt: toLocalTime(startAt), endsAt: toLocalTime(endsAt) });
    } else if (status === "results") {
      void climb.finish();
    } else if (status === "lobby") {
      climb.leaveRace();
    }
  }, [roomCode, room]);

  // Live climbs: on today's tower, see (and be seen by) everyone climbing it right now.
  const live = showLive && mode === "daily" && !race && (playing || phase === "summit");
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
      const { phase: p, finish, leaveRace } = useClimb.getState();
      if (p === "playing" || p === "summit") void finish();
      leaveRace();
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
      {(playing || phase === "summit" || phase === "countdown") && <Hud touch={touch} />}
      {(phase === "countdown" || playing) && race && <RaceCountdown />}
      {(phase === "menu" || phase === "starting") && (roomCode ? <Lobby /> : <Menu />)}
      {phase === "over" && (race ? <RaceResults /> : <Results />)}
      <Locker />
    </div>
  );
}
