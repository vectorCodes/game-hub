// Pair Pop's tile on the GameHub page: a few memory tiles flipping in a candy sky (no
// three.js, so the hub stays light) and a line of status.
import { useEffect } from "react";
import { dailyNumber } from "./deck";
import { savedDaily } from "./guest";
import { usePairPopProgress } from "./progress";

const TILES: [string, string, number, number][] = [
  // [face, colour, left %, top %]
  ["🐼", "#7ddc6f", 14, 26],
  ["🍩", "#ff8fc8", 40, 16],
  ["🐼", "#7ddc6f", 66, 30],
  ["🦊", "#ffb340", 26, 58],
  ["🐝", "#ffd84d", 54, 56],
];

export function PairPopCover() {
  return (
    <div className="relative h-full min-h-64 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_10%,#a48bff_0%,#6a4ae6_45%,#2f1a86_100%)] md:min-h-80">
      {TILES.map(([face, color, left, top], i) => (
        <div key={i} aria-hidden className="absolute w-[20%] [perspective:500px]" style={{ left: `${left}%`, top: `${top}%`, animation: `pp-bob ${5 + i * 0.6}s ease-in-out ${-i}s infinite` }}>
          <div className="relative aspect-square [transform-style:preserve-3d]" style={{ animation: `pp-flip 5s cubic-bezier(0.5,0,0.2,1.3) ${i * 0.45}s infinite` }}>
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br from-[#7c6cff] to-[#38c8e8] text-2xl font-black text-white shadow-[0_6px_0_#3a2a9e] [backface-visibility:hidden]">?</div>
            <div className="absolute inset-0 grid place-items-center rounded-2xl text-3xl shadow-[0_6px_0_rgba(0,0,0,0.25)] [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: color }}>
              {face}
            </div>
          </div>
        </div>
      ))}
      <span className="absolute top-4 left-4 rounded-full bg-stone-950/80 px-3 py-1 text-xs font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur">New · Memory game</span>
      <span className="absolute top-4 right-4 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">3D</span>
    </div>
  );
}

export function PairPopStatus() {
  const board = usePairPopProgress((s) => s.daily);
  usePairPopProgress((s) => s.version);
  useEffect(() => {
    if (!usePairPopProgress.getState().daily) void usePairPopProgress.getState().load();
  }, []);
  const mine = savedDaily();
  return (
    <span>
      Daily #{dailyNumber()} ·{" "}
      {mine ? (
        <span className="text-moss-300">
          {"★".repeat(mine.stars)} in {mine.moves} moves
        </span>
      ) : (
        <span className="text-stone-200">{board?.players ? `${board.players} played today` : "a fresh board is waiting"}</span>
      )}
    </span>
  );
}
