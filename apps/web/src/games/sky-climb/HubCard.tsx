// Sky Climb's tile on the GameHub page: the tower drawn as an elevation plate (SVG, no
// three.js, so the hub stays light) and a line of live status.
import { useEffect } from "react";
import { CoverFrame } from "../../components/CoverFrame";
import { useClimb } from "./store";

/** Stars in the upper sky, from a fixed seed so they never move between visits: [x, y, r, opacity]. */
const STARS: [number, number, number, number][] = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453;
  const b = Math.sin(i * 311.7) * 24634.6345;
  const u = a - Math.floor(a);
  const v = b - Math.floor(b);
  return [u * 400, v * v * 130, 0.4 + ((i * 7) % 5) * 0.18, 0.35 + ((i * 13) % 7) * 0.09];
});

/** Platforms climbing away from us, nearest first: [centre x, top y, width, checkpoint]. */
const PLATFORMS: [number, number, number, boolean][] = [
  [196, 214, 86, false],
  [132, 182, 64, false],
  [228, 156, 54, true],
  [168, 128, 44, false],
  [222, 106, 36, false],
  [180, 86, 30, true],
  [212, 68, 24, false],
  [190, 52, 20, false],
];

/** A floating slab: a lit top face, a shaded front, a hanging tuft of meadow underneath. */
function Platform({ x, y, w, checkpoint, depth }: { x: number; y: number; w: number; checkpoint: boolean; depth: number }) {
  const h = Math.max(3, w * 0.12);
  const lip = w * 0.08;
  return (
    <g opacity={1 - depth * 0.5}>
      <path d={`M${x - w / 2} ${y} l${w} 0 l${-lip} ${-h} l${-w + 2 * lip} 0 Z`} fill={checkpoint ? "#ffd27a" : "#f4e4ff"} />
      <rect x={x - w / 2} y={y} width={w} height={h * 1.5} fill={checkpoint ? "#b9772c" : "#6a4f9e"} />
      <path d={`M${x - w / 2 + 3} ${y + h * 1.5} q${w / 2 - 3} ${h * 2.6} ${w - 6} 0 Z`} fill={checkpoint ? "#7a4a1c" : "#3c2c6b"} />
    </g>
  );
}

/**
 * Key art for the tower: a dusk meadow at the bottom of the frame, deep space at the top,
 * floating floors stepping up between them toward the Moon, and a climber mid-jump.
 */
export function SkyClimbCover() {
  const last = PLATFORMS.length - 1;
  const [fx, fy] = PLATFORMS[last];
  return (
    <CoverFrame label="Floating platforms climb from a dusk meadow toward the Moon, with a climber mid-jump.">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#06051a" />
            <stop offset="0.38" stopColor="#1d1650" />
            <stop offset="0.66" stopColor="#5a3f9a" />
            <stop offset="0.86" stopColor="#d47b8e" />
            <stop offset="1" stopColor="#f6b98a" />
          </linearGradient>
          <radialGradient id="sc-moon" cx="0.38" cy="0.35">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#d9cdf2" />
          </radialGradient>
          <radialGradient id="sc-moon-glow">
            <stop offset="0" stopColor="#b9a4ff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#b9a4ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sc-climber-glow">
            <stop offset="0" stopColor="#fff2c8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#fff2c8" stopOpacity="0" />
          </radialGradient>
          <filter id="sc-cloud" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <rect width="400" height="260" fill="url(#sc-sky)" />
        {STARS.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" fillOpacity={o} />
        ))}

        {/* The Moon, past which the tower goes on. */}
        <circle cx="314" cy="62" r="70" fill="url(#sc-moon-glow)" />
        <circle cx="314" cy="62" r="26" fill="url(#sc-moon)" />
        <circle cx="306" cy="56" r="5" fill="#8f7fc0" fillOpacity="0.18" />
        <circle cx="322" cy="72" r="3.5" fill="#8f7fc0" fillOpacity="0.16" />
        <circle cx="320" cy="50" r="2.4" fill="#8f7fc0" fillOpacity="0.14" />

        {/* The storm band halfway up, soft. */}
        <g filter="url(#sc-cloud)" fill="#f2c9d6">
          <ellipse cx="80" cy="150" rx="90" ry="12" fillOpacity="0.35" />
          <ellipse cx="320" cy="164" rx="110" ry="14" fillOpacity="0.3" />
          <ellipse cx="200" cy="140" rx="60" ry="7" fillOpacity="0.2" />
        </g>

        {/* The meadow: far hills, then near ones in silhouette. */}
        <path d="M0 226 Q70 204 140 220 T280 214 T400 222 V260 H0 Z" fill="#3b2a63" />
        <path d="M0 240 Q90 222 180 238 T400 232 V260 H0 Z" fill="#1a1338" />
        <path d="M0 240 Q90 222 180 238 T400 232" fill="none" stroke="#f6b98a" strokeOpacity="0.35" strokeWidth="1" />

        {/* The tower, receding as it rises. Far floors first, so near ones overlap them. */}
        {PLATFORMS.map((p, i) => ({ p, i }))
          .reverse()
          .map(({ p: [x, y, w, checkpoint], i }) => (
            <Platform key={i} x={x} y={y} w={w} checkpoint={checkpoint} depth={i / last} />
          ))}

        {/* The flag at the top, catching the moonlight. */}
        <line x1={fx} y1={fy - 2} x2={fx} y2={fy - 20} stroke="#f4e4ff" strokeOpacity="0.75" strokeWidth="1" />
        <path d={`M${fx} ${fy - 20} l9 3 l-9 3 Z`} fill="#ffd27a" />

        {/* The climber, between the second and third floors, with the arc of the jump. */}
        <path d="M140 176 Q170 128 214 146" fill="none" stroke="#fff2c8" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="1 5" strokeLinecap="round" />
        <g className="cover-hop">
          <circle cx="178" cy="140" r="18" fill="url(#sc-climber-glow)" />
          <g transform="translate(178 140) rotate(12)" fill="#1a1338">
            <circle cx="0" cy="-9" r="4.2" />
            <path d="M-4 -4 Q0 -6 4 -4 L5 6 Q0 8 -5 6 Z" />
            <path d="M-4 -2 L-11 -8 M4 -2 L10 -9 M-3 6 L-7 13 M3 6 L8 11" stroke="#1a1338" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>
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
