// /games/putt-isles/play: the course, with its HUD.
import { lazy, Suspense, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { useAuth } from "../../auth/store";
import { cancelAim, strike, useCameraKeys } from "./input";
import { usePutt } from "./store";
import { Hud } from "./ui/Hud";

const Game = lazy(() => import("./scene/Game"));

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-stone-950">
      <div className="text-center">
        <div className="font-display text-2xl font-semibold">Raising the islands…</div>
        <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-moss-300 to-moss-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function PuttIslesPage() {
  const phase = usePutt((s) => s.phase);
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  useCameraKeys(phase === "aim" || phase === "rolling");

  // Start (or pick up) the round once we know who's playing.
  useEffect(() => {
    if (synced) void usePutt.getState().begin();
  }, [synced, userId]);

  // Today's board, for the rank on the scorecard.
  useEffect(() => {
    if (synced) void usePutt.getState().loadDaily();
  }, [synced, userId]);

  // Leaving the page drops the shot in hand; the round is on the server to come back to.
  useEffect(
    () => () => {
      cancelAim();
      strike.pending = false;
      usePutt.setState({ phase: "loading" });
    },
    [],
  );

  return (
    <div className="relative h-[calc(100dvh-4rem)] touch-none overflow-hidden bg-stone-950 select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Loader />
      <Hud />
    </div>
  );
}
