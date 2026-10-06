// Putt Isles' tile on the GameHub page: painted floating islands with a course across them
// (no three.js, so the hub stays light) and a line of status.
import { useEffect } from "react";
import { formatToPar, generatePuttCourse, puttTotals } from "@shadow/shared";
import { usePutt } from "./store";

/** Islands: [left %, top %, width %]. */
const ISLANDS: [number, number, number][] = [
  [6, 58, 34],
  [40, 30, 30],
  [66, 54, 28],
];

export function PuttIslesCover() {
  return (
    <div className="relative h-full min-h-64 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#3f8fe0_0%,#7fc0f2_45%,#d6eefc_100%)] md:min-h-80">
      {/* Clouds. */}
      {[
        [8, 16, 18],
        [62, 10, 22],
        [30, 82, 26],
        [74, 86, 20],
      ].map(([x, y, w], i) => (
        <span key={i} aria-hidden className="absolute h-[7%] animate-drift rounded-full bg-white/80 blur-[1px]" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, animationDelay: `${i * 0.6}s` }} />
      ))}
      {ISLANDS.map(([left, top, width], i) => (
        <div key={i} aria-hidden className="absolute animate-drift" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, animationDelay: `${i * 0.5}s` }}>
          {/* Grass, the green with its orange rails, and the rock below. */}
          <div className="relative h-5 rounded-[50%] bg-[#79c66b] shadow-[0_6px_0_#5b9e4f]">
            <div className="absolute inset-x-[18%] top-[22%] h-[56%] rounded-md bg-[#5fd08a] ring-2 ring-[#ec8a5a]" />
          </div>
          <div className="mx-auto h-10 w-[70%] bg-[#9b6b4a] [clip-path:polygon(0_0,100%_0,60%_100%,40%_100%)]" />
        </div>
      ))}
      <span aria-hidden className="absolute top-[18%] left-[53%] text-3xl drop-shadow-lg">
        ⛳
      </span>
      <span aria-hidden className="absolute top-[52%] left-[20%] h-3 w-3 animate-drift rounded-full bg-white shadow-md ring-1 ring-black/10 [animation-delay:0.8s]" />
      <span className="absolute top-4 left-4 rounded-full bg-stone-950/80 px-3 py-1 text-xs font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur">
        New · Daily course
      </span>
      <span className="absolute top-4 right-4 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">3D</span>
    </div>
  );
}

export function PuttIslesStatus() {
  const daily = usePutt((s) => s.daily);
  const loadDaily = usePutt((s) => s.loadDaily);
  useEffect(() => {
    if (!daily) void loadDaily();
  }, [daily, loadDaily]);
  if (!daily) return <span>A new course every day</span>;
  const mine = daily.myRound;
  return (
    <span>
      Course #{daily.number} ·{" "}
      {mine?.status === "finished" ? (
        <span className="text-moss-300">you shot {formatToPar(puttTotals(mine.strokes, generatePuttCourse(mine.seed).map((h) => h.par)).toPar)}</span>
      ) : (
        <span className="text-stone-200">{daily.players ? `${daily.players} finished today` : "be the first round today"}</span>
      )}
    </span>
  );
}
