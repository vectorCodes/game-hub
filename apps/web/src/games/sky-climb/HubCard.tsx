// Sky Climb's tile on the GameHub page: the tower drawn as an elevation plate (SVG, no
// three.js, so the hub stays light) and a line of live status.
import { useEffect } from "react";
import { CoverFrame } from "../../components/CoverFrame";
import { useClimb } from "./store";

/** Floors of the elevation drawing: [x, y, width, checkpoint]. Bottom to top. */
const FLOORS_ART: [number, number, number, boolean][] = [
  [150, 214, 70, false],
  [196, 194, 52, false],
  [158, 174, 46, true],
  [204, 154, 44, false],
  [166, 134, 40, false],
  [208, 114, 36, true],
  [172, 94, 34, false],
  [206, 74, 30, false],
  [180, 54, 30, true],
];

/**
 * The tower as an architect's elevation: a hairline shaft, floors stepping up it (gold at
 * the checkpoints), a floor scale down the side, a red sun behind, and one dot climbing.
 */
export function SkyClimbCover() {
  return (
    <CoverFrame number="02" title="Sky Climb" meta="Daily tower" caption="100 floors · meadow to stars">
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
        <circle cx="292" cy="120" r="46" fill="#d9582c" />
        {/* The shaft. */}
        <rect x="140" y="30" width="120" height="196" fill="none" stroke="#2a2216" strokeOpacity="0.3" strokeWidth="1" />
        <line x1="200" y1="30" x2="200" y2="226" stroke="#2a2216" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 4" />
        {/* Floors. */}
        {FLOORS_ART.map(([x, y, w, checkpoint], i) => (
          <rect key={i} x={x} y={y} width={w} height="4" fill={checkpoint ? "#cc922f" : "#2a2216"} />
        ))}
        {/* The flag at the top. */}
        <line x1="196" y1="54" x2="196" y2="34" stroke="#2a2216" strokeWidth="1.4" />
        <path d="M196 34 L210 38.5 L196 43 Z" fill="#cc922f" />
        {/* The floor scale. */}
        <line x1="112" y1="40" x2="112" y2="216" stroke="#2a2216" strokeOpacity="0.4" strokeWidth="1" />
        {[
          [216, "1"],
          [172, "25"],
          [128, "50"],
          [84, "75"],
          [40, "100"],
        ].map(([y, label]) => (
          <g key={label}>
            <line x1="106" y1={y} x2="112" y2={y} stroke="#2a2216" strokeOpacity="0.5" strokeWidth="1" />
            <text x="100" y={Number(y) + 3} textAnchor="end" fontFamily="Azeret Mono, monospace" fontSize="8" letterSpacing="1" fill="#2a2216" fillOpacity="0.55">
              {label}
            </text>
          </g>
        ))}
        {/* The climber. */}
        <circle className="cover-climb" cx="186" cy="204" r="5" fill="#2f8a73" />
      </svg>
    </CoverFrame>
  );
}

export function SkyClimbStatus() {
  const daily = useClimb((s) => s.daily);
  const loadDaily = useClimb((s) => s.loadDaily);
  useEffect(() => {
    if (!daily) void loadDaily();
  }, [daily, loadDaily]);
  if (!daily) return <span>A new tower every day</span>;
  return (
    <span>
      Tower #{daily.number} ·{" "}
      {daily.myBest ? (
        <span className="text-moss-300">your best: floor {daily.myBest.floor}</span>
      ) : (
        <span className="text-stone-200">{daily.climbers ? `${daily.climbers} climbing today` : "be the first up today"}</span>
      )}
    </span>
  );
}
