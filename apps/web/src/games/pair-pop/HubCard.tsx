// Pair Pop's tile on the GameHub page: a board of tiles drawn as a print (SVG, no three.js,
// so the hub stays light) and a line of status.
import { useEffect } from "react";
import { CoverFrame } from "../../components/CoverFrame";
import { dailyNumber } from "./deck";
import { savedDaily } from "./guest";
import { usePairPopProgress } from "./progress";

/** A 4 × 3 board: two pairs found (sun circles, jade triangles), one tile turning, the rest face down. */
const FOUND: Record<number, "sun" | "jade"> = { 1: "sun", 10: "sun", 4: "jade", 7: "jade" };
const TURNING = 6;
const TILE = 50;
const GAP = 12;
const LEFT = (400 - (4 * TILE + 3 * GAP)) / 2;
const TOP = (240 - (3 * TILE + 2 * GAP)) / 2;

export function PairPopCover() {
  return (
    <CoverFrame number="03" title="Pair Pop" meta={`Daily #${dailyNumber()}`} caption="Memory · find the twins">
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => {
          const x = LEFT + (i % 4) * (TILE + GAP);
          const y = TOP + Math.floor(i / 4) * (TILE + GAP);
          const found = FOUND[i];
          const cx = x + TILE / 2;
          const cy = y + TILE / 2;
          if (found)
            return (
              <g key={i}>
                <rect x={x} y={y} width={TILE} height={TILE} fill={found === "sun" ? "#d9582c" : "#2f8a73"} />
                {found === "sun" ? (
                  <circle cx={cx} cy={cy} r="11" fill="#f8f2e7" />
                ) : (
                  <path d={`M${cx} ${cy - 12} L${cx + 12} ${cy + 9} L${cx - 12} ${cy + 9} Z`} fill="#f8f2e7" />
                )}
                <circle cx={x + TILE - 6} cy={y + 6} r="2.2" fill="#cc922f" />
              </g>
            );
          return (
            <g key={i} className={i === TURNING ? "cover-flip" : undefined}>
              <rect x={x + 0.5} y={y + 0.5} width={TILE - 1} height={TILE - 1} fill={i === TURNING ? "#cc922f" : "#f3ead9"} stroke="#2a2216" strokeOpacity="0.3" strokeWidth="1" />
              <text x={cx} y={cy + 5} textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="16" fill="#2a2216" fillOpacity={i === TURNING ? 0.9 : 0.35}>
                ?
              </text>
            </g>
          );
        })}
      </svg>
    </CoverFrame>
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
