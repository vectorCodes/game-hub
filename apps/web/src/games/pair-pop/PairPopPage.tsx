// /games/pair-pop/play: the board, with its HUD. `?level=3` plays level 3; no level is
// today's daily.
import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useProgress } from "@react-three/drei";
import { LEVELS } from "./config";
import { levelUnlocked } from "./guest";
import { useAuth } from "../../auth/store";
import { usePairPopProgress } from "./progress";
import { usePairPop } from "./store";
import { EXTRUDE, Hud } from "./ui/Hud";

const Game = lazy(() => import("./scene/Game"));

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="text-center">
        <div className="font-display text-2xl font-black text-white sm:text-3xl" style={{ textShadow: EXTRUDE }}>
          Shuffling the pals…
        </div>
        <div className="mx-auto mt-5 h-3 w-48 overflow-hidden sm:w-56 rounded-full bg-black/25 ring-1 ring-white/20">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffd84d] to-[#ff6fae] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function PairPopPage() {
  const [params] = useSearchParams();
  const param = params.get("level");
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);

  // Once we know who's playing: their stars from the server (a level opened on another
  // device opens here too), then the board.
  useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    void usePairPopProgress
      .getState()
      .load()
      .then(() => {
        if (cancelled) return;
        const level = param === null ? -1 : Number(param) - 1;
        const valid = Number.isInteger(level) && level >= 0 && level < LEVELS.length && levelUnlocked(level);
        const { setMode, start } = usePairPop.getState();
        setMode(valid ? { kind: "level", level } : { kind: "daily" });
        void start();
      });
    return () => {
      cancelled = true;
    };
  }, [param, synced, userId]);

  return (
    <div className="relative h-dvh touch-manipulation overflow-hidden overscroll-none bg-[radial-gradient(ellipse_90%_70%_at_50%_15%,#9a7dff_0%,#6a4ae6_38%,#3a1f9e_72%,#1c0e5a_100%)] select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Loader />
      <Hud />
    </div>
  );
}
