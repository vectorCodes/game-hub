// Prop Hunt's tile on the GameHub page: a shelf of mugs, one of which is looking back, with a
// seeker's crosshair closing in. Drawn as a print (SVG, no three.js, so the hub stays light).
import { HUNT_MAX_PLAYERS, HUNT_MIN_PLAYERS } from "@shadow/shared";
import { CoverFrame } from "../../components/CoverFrame";

const INK = "#2a2216";
const PAPER = "#f8f2e7";

/** A mug, its base at (x, y). */
function Mug({ x, y, fill, eyes = false }: { x: number; y: number; fill: string; eyes?: boolean }) {
  return (
    <g>
      <rect x={x - 14} y={y - 34} width="28" height="34" rx="3" fill={fill} stroke={INK} strokeOpacity="0.35" />
      <path d={`M${x + 14} ${y - 26} q12 0 12 9 q0 9 -12 9`} fill="none" stroke={fill} strokeWidth="5" />
      {eyes && (
        <g className="cover-flip">
          <circle cx={x - 5} cy={y - 20} r="4" fill={PAPER} />
          <circle cx={x + 5} cy={y - 20} r="4" fill={PAPER} />
          <circle cx={x - 4} cy={y - 19} r="1.8" fill={INK} />
          <circle cx={x + 6} cy={y - 19} r="1.8" fill={INK} />
        </g>
      )}
    </g>
  );
}

export function PropHuntCover() {
  return (
    <CoverFrame number="04" title="Prop Hunt" meta="Multiplayer" caption={`Hide & seek · ${HUNT_MIN_PLAYERS}–${HUNT_MAX_PLAYERS} friends`}>
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
        {/* The shelf and its bracket. */}
        <rect x="70" y="128" width="260" height="8" fill="#9b7650" />
        <path d="M100 136 v18 h10 M300 136 v18 h-10" stroke="#9b7650" strokeWidth="5" fill="none" />
        <Mug x={110} y={128} fill={PAPER} />
        <Mug x={160} y={128} fill="#d9582c" />
        <Mug x={210} y={128} fill={PAPER} eyes />
        <Mug x={260} y={128} fill="#2f8a73" />
        <Mug x={300} y={128} fill={PAPER} />
        {/* A toy car on the floor, and the floor. */}
        <rect x="60" y="196" width="280" height="2" fill={INK} fillOpacity="0.25" />
        <rect x="88" y="178" width="40" height="14" rx="3" fill="#3f6fb0" />
        <rect x="96" y="170" width="22" height="10" rx="2" fill="#3f6fb0" />
        <circle cx="98" cy="194" r="4" fill={INK} />
        <circle cx="120" cy="194" r="4" fill={INK} />
        {/* The seeker's crosshair, drifting towards the mug that blinked. */}
        <g className="cover-aim">
          <circle cx="210" cy="106" r="22" fill="none" stroke="#cc922f" strokeWidth="2.5" />
          <path d="M210 78 v14 M210 120 v14 M182 106 h14 M224 106 h14" stroke="#cc922f" strokeWidth="2.5" />
          <circle cx="210" cy="106" r="2.5" fill="#cc922f" />
        </g>
      </svg>
    </CoverFrame>
  );
}

export function PropHuntStatus() {
  return (
    <span>
      Rooms of {HUNT_MIN_PLAYERS}–{HUNT_MAX_PLAYERS} · <span className="text-stone-200">invite friends with a code</span>
    </span>
  );
}
