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
import { Hud } from "./ui/Hud";

const Game = lazy(() => import("./scene/Game"));

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="text-center">
        <div className="label-mono text-lamp-300">Pair Pop</div>
        <div className="mt-2 font-display text-2xl font-light text-stone-50 uppercase sm:text-3xl">Shuffling the pals…</div>
        <div className="mx-auto mt-5 h-1 w-48 overflow-hidden bg-white/12 sm:w-56">
          <div className="h-full bg-lamp-400 transition-[width]" style={{ width: `${progress}%` }} />
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
    <div className="relative h-dvh touch-manipulation overflow-hidden overscroll-none bg-paper select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Loader />
      <Hud />
    </div>
  );
}
