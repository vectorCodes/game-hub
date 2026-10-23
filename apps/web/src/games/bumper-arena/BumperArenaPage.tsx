// /games/bumper-arena/play: the menu (bots playing behind it), Practice and the Daily
// Gauntlet. Computers and tablets only. See Bumper-arena-plan.md.
import { lazy, Suspense, useEffect, useState } from "react";
import { useKeyboard } from "./input";
import { game, useBumper } from "./store";
import { Hud } from "./ui/Hud";
import { Menu } from "./ui/Menu";
import { isPhone, NoPhonesScreen } from "./ui/NoPhones";
import { TuningPanel } from "./ui/Tuning";

const Game = lazy(() => import("./scene/Game"));

function BumperGame() {
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const showTuning = useBumper((s) => s.showTuning);
  const mode = useBumper((s) => s.mode);
  useKeyboard(mode !== "menu");

  // The menu on arriving; leaving drops the round.
  useEffect(() => {
    useBumper.getState().openMenu();
    return () => {
      game.sim = null;
      game.brains = [];
    };
  }, []);

  // Enter: the next Practice round once this one is over. T (dev builds): the tuning panel.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const { mode, phase, next, toggleTuning } = useBumper.getState();
      if (e.code === "Enter" && mode === "practice" && phase === "over") next();
      if (e.code === "KeyT" && import.meta.env.DEV) toggleTuning();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="relative h-dvh touch-none overflow-hidden bg-[#cfe6ee] select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Hud touch={touch} />
      {mode === "menu" && <Menu touch={touch} />}
      {showTuning && <TuningPanel />}
    </div>
  );
}

export default function BumperArenaPage() {
  const [phone] = useState(isPhone);
  return phone ? <NoPhonesScreen /> : <BumperGame />;
}
