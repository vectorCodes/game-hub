// /dev/bumper (dev builds only): Bumper Arena's phase 1 feel prototype. You against 1–7 bots
// on Picnic Plate, offline, with a live tuning panel. Computers and tablets only. See
// Bumper-arena-plan.md.
import { lazy, Suspense, useEffect, useState } from "react";
import { useKeyboard } from "./input";
import { game, useBumper } from "./store";
import { Hud } from "./ui/Hud";
import { isPhone, NoPhonesScreen } from "./ui/NoPhones";
import { TuningPanel } from "./ui/Tuning";

const Game = lazy(() => import("./scene/Game"));

function BumperGame() {
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const showTuning = useBumper((s) => s.showTuning);
  useKeyboard(true);

  // A fresh first round on arriving; leaving clears the round and the score.
  useEffect(() => {
    useBumper.getState().next();
    return () => {
      game.sim = null;
      useBumper.setState({ round: 0, wins: {} });
    };
  }, []);

  // Enter: next round once this one is over. T: the tuning panel.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const { phase, next, toggleTuning } = useBumper.getState();
      if (e.code === "Enter" && phase === "over") next();
      if (e.code === "KeyT") toggleTuning();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="fixed inset-0 z-40 touch-none overflow-hidden bg-[#cfe6ee] select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Hud touch={touch} />
      {showTuning && <TuningPanel />}
    </div>
  );
}

export default function BumperPrototype() {
  const [phone] = useState(isPhone);
  return phone ? <NoPhonesScreen /> : <BumperGame />;
}
