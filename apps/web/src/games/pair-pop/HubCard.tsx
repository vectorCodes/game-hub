// Pair Pop's tile on the GameHub page: a board of tiles drawn as a print (SVG, no three.js,
// so the hub stays light) and a line of status.
import { useEffect } from "react";
import { CoverFrame } from "../../components/CoverFrame";
import { dailyNumber } from "./deck";
import { savedDaily } from "./guest";
import { usePairPopProgress } from "./progress";

/** The board lies tilted away from us: board units (centred) to the picture's. */
const project = (px: number, py: number): [number, number] => [200 + px - 0.32 * py, 150 + 0.6 * py];
const PLANE = "matrix(1 0 -0.32 0.6 200 150)";
const PLANE_EDGE = "matrix(1 0 -0.32 0.6 200 158)";
const TILE = 52;
const STEP = 64;
const TILES = Array.from({ length: 12 }, (_, i) => {
  const x = -122 + (i % 4) * STEP;
  const y = -90 + Math.floor(i / 4) * STEP;
  return { i, x, y, centre: project(x + TILE / 2, y + TILE / 2) };
});
/** The twins found so far, and the tile being turned. */
const MATCHED = new Set([2, 9]);
const TURNING = 5;

/** One of the pals that live under the tiles, standing at (x, y). */
function Pal({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.15)`}>
      <ellipse cx="0" cy="1" rx="14" ry="4" fill="#000" fillOpacity="0.3" />
      <circle cx="-10" cy="-25" r="5" fill="url(#pp-pal)" />
      <circle cx="10" cy="-25" r="5" fill="url(#pp-pal)" />
      <ellipse cx="0" cy="-13" rx="15" ry="13.5" fill="url(#pp-pal)" />
      <ellipse cx="-5" cy="-20" rx="5" ry="2.8" fill="#fff" fillOpacity="0.45" />
      <ellipse cx="-5" cy="-14" rx="1.7" ry="2.3" fill="#2a0f22" />
      <ellipse cx="5" cy="-14" rx="1.7" ry="2.3" fill="#2a0f22" />
      <circle cx="-9.5" cy="-9" r="2.2" fill="#ff4f86" fillOpacity="0.55" />
      <circle cx="9.5" cy="-9" r="2.2" fill="#ff4f86" fillOpacity="0.55" />
      <path d="M-2.2 -9.5 q2.2 2.2 4.4 0" fill="none" stroke="#2a0f22" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

/** A four-point glint. */
function Glint({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 Q0 0 6 0 Q0 0 0 6 Q0 0 -6 0 Q0 0 0 -6 Z" fill="#c9fff0" />;
}

/**
 * Key art for the memory board: a tilted board of tiles in a plum dark, one tile turning
 * over, and a pair of twin pals already found, glowing mint where they popped.
 */
export function PairPopCover() {
  const [a, b] = [...MATCHED].map((i) => TILES[i].centre);
  const [tx, ty] = TILES[TURNING].centre;
  return (
    <CoverFrame label="A tilted board of memory tiles; two matching pals glow on it while another tile turns over.">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="pp-bg" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0" stopColor="#40174a" />
            <stop offset="1" stopColor="#0e0513" />
          </radialGradient>
          <linearGradient id="pp-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8a3a86" />
            <stop offset="1" stopColor="#521b57" />
          </linearGradient>
          <linearGradient id="pp-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9ccb" />
            <stop offset="1" stopColor="#c13c7c" />
          </linearGradient>
          <radialGradient id="pp-pal" cx="0.35" cy="0.3">
            <stop offset="0" stopColor="#ffb3d3" />
            <stop offset="1" stopColor="#e2477f" />
          </radialGradient>
          <radialGradient id="pp-pop">
            <stop offset="0" stopColor="#8ff5d6" stopOpacity="0.75" />
            <stop offset="1" stopColor="#8ff5d6" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="400" height="260" fill="url(#pp-bg)" />

        {/* Tile edges, then faces. */}
        <g transform={PLANE_EDGE}>
          {TILES.map(({ i, x, y }) => (
            <rect key={i} x={x} y={y} width={TILE} height={TILE} rx="9" fill={MATCHED.has(i) ? "#9c7f86" : "#2a0c2e"} />
          ))}
        </g>
        <g transform={PLANE}>
          {TILES.map(({ i, x, y }) =>
            MATCHED.has(i) ? (
              <rect key={i} x={x} y={y} width={TILE} height={TILE} rx="9" fill="#fbeee4" />
            ) : i === TURNING ? (
              <rect key={i} x={x} y={y} width={TILE} height={TILE} rx="9" fill="#1c0820" />
            ) : (
              <g key={i}>
                <rect x={x} y={y} width={TILE} height={TILE} rx="9" fill="url(#pp-face)" />
                <rect x={x + 5} y={y + 5} width={TILE - 10} height={TILE - 10} rx="6" fill="none" stroke="#ffb3d3" strokeOpacity="0.22" />
                <circle cx={x + TILE / 2} cy={y + TILE / 2} r="4" fill="#ffb3d3" fillOpacity="0.28" />
              </g>
            ),
          )}
        </g>

        {/* The found pair, joined, glowing where they popped. */}
        <path d={`M${a[0]} ${a[1] - 30} Q${(a[0] + b[0]) / 2 + 40} ${Math.min(a[1], b[1]) - 70} ${b[0]} ${b[1] - 30}`} fill="none" stroke="#8ff5d6" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
        {[a, b].map(([x, y], k) => (
          <g key={k}>
            <circle cx={x} cy={y - 14} r="38" fill="url(#pp-pop)" />
            <Pal x={x} y={y + 4} />
          </g>
        ))}
        <Glint x={a[0] + 26} y={a[1] - 36} />
        <Glint x={a[0] - 24} y={a[1] - 18} s={0.6} />
        <Glint x={b[0] + 24} y={b[1] - 30} s={0.8} />
        <Glint x={b[0] - 28} y={b[1] - 40} s={0.5} />

        {/* The tile being turned, lifted off its slot. */}
        <ellipse cx={tx} cy={ty + 2} rx="22" ry="7" fill="#000" fillOpacity="0.35" />
        <g className="cover-flip">
          <rect x={tx - 20} y={ty - 62} width="40" height="48" rx="8" fill="url(#pp-card)" />
          <rect x={tx - 15} y={ty - 57} width="30" height="38" rx="5" fill="none" stroke="#fff" strokeOpacity="0.5" />
          <circle cx={tx} cy={ty - 38} r="5" fill="#fff" fillOpacity="0.8" />
        </g>
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
