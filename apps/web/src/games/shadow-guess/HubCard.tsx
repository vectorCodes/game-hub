// Shadow Guess cards: the GameHub tile (cover + status) and the full card on the game's
// landing page (today's puzzle, the player's status, and a countdown).
// Kept free of three.js so the pages that show them stay light.
import { Link } from "react-router";
import type { DailyInfo } from "@shadow/shared";
import { CoverFrame } from "../../components/CoverFrame";
import { formatCountdown } from "../../lib/format";
import { dailyCta, dailyDone, SHADOW_GUESS_PATH, useDaily, useNow } from "./useDaily";

function statusLine(info: DailyInfo): string {
  switch (info.status) {
    case "won":
      return `Solved · ${info.score} points`;
    case "lost":
      return "Out of angles today";
    case "playing":
      return `In progress · angle ${(info.step ?? 0) + 1} of 6`;
    default:
      return "Not played yet";
  }
}

/** A spindle-back chair, front on, in local units: legs on y = 0, up is negative. */
const CHAIR = (
  <>
    <rect x="0" y="-150" width="8" height="150" />
    <rect x="64" y="-150" width="8" height="150" />
    <path d="M-5 -150 Q36 -168 77 -150 L77 -137 Q36 -153 -5 -137 Z" />
    <rect x="19" y="-142" width="4" height="74" />
    <rect x="34" y="-145" width="4" height="77" />
    <rect x="49" y="-142" width="4" height="74" />
    <path d="M-11 -72 L83 -72 L92 -59 L-20 -59 Z" />
    <path d="M-17 -59 L-8 -59 L-13 0 L-22 0 Z M80 -59 L89 -59 L94 0 L85 0 Z" />
    <rect x="-14" y="-27" width="100" height="4" />
  </>
);

/** Dust caught in the beam: [x, y, r, opacity]. */
const MOTES: [number, number, number, number][] = [
  [292, 70, 1.2, 0.7],
  [268, 96, 0.9, 0.5],
  [246, 58, 1.4, 0.45],
  [222, 130, 1, 0.55],
  [300, 104, 0.8, 0.4],
  [258, 140, 1.1, 0.35],
];

/**
 * A dark room and one warm spotlight. The object stays out of frame: all you get is its
 * shadow, thrown big across the lit wall, leaning slowly as the light turns.
 */
function ShadowArt({ info }: { info: DailyInfo | null }) {
  return (
    <CoverFrame
      label="A spotlight throws the shadow of a hidden chair onto a dark wall."
      caption={info?.theme?.name}
      className="aspect-[16/10] md:aspect-auto"
    >
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sg-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#140d08" />
            <stop offset="1" stopColor="#2a1b10" />
          </linearGradient>
          <linearGradient id="sg-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2614" />
            <stop offset="1" stopColor="#0d0805" />
          </linearGradient>
          <radialGradient id="sg-pool">
            <stop offset="0" stopColor="#ffe3b0" />
            <stop offset="0.35" stopColor="#f2b660" />
            <stop offset="0.7" stopColor="#b8692a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#7a3f17" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sg-pool-mask">
            <stop offset="0.25" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="sg-spill">
            <stop offset="0" stopColor="#f2b660" stopOpacity="0.5" />
            <stop offset="1" stopColor="#f2b660" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sg-beam" x1="1" y1="0" x2="0" y2="0.6">
            <stop offset="0" stopColor="#ffe9c2" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ffd08a" stopOpacity="0" />
          </linearGradient>
          <filter id="sg-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
          <filter id="sg-haze" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <mask id="sg-lit">
            <ellipse cx="190" cy="104" rx="128" ry="102" fill="url(#sg-pool-mask)" />
          </mask>
        </defs>

        {/* Wall, the pool of light on it, and the floor below. */}
        <rect width="400" height="182" fill="url(#sg-wall)" />
        <ellipse cx="190" cy="104" rx="128" ry="102" fill="url(#sg-pool)" />
        <rect y="182" width="400" height="78" fill="url(#sg-floor)" />
        <ellipse cx="196" cy="190" rx="150" ry="16" fill="url(#sg-spill)" />
        <rect y="181" width="400" height="1.2" fill="#ffcf8a" fillOpacity="0.22" />

        {/* The beam, from a lamp just out of frame, with dust hanging in it. */}
        <polygon points="352,24 350,54 92,198 116,6" fill="url(#sg-beam)" filter="url(#sg-haze)" style={{ mixBlendMode: "screen" }} />
        {MOTES.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff1d6" fillOpacity={o} />
        ))}

        {/* The shadow: only where the light reaches, softened at the edge. */}
        <g mask="url(#sg-lit)">
          <g transform="translate(152 182) scale(1.12) skewX(5)">
            <g className="cover-lean" fill="#140b05" fillOpacity="0.94" filter="url(#sg-soft)">
              {CHAIR}
            </g>
          </g>
        </g>

        {/* The lamp's barn-door edge, catching the light at the frame. */}
        <g transform="translate(372 30) rotate(158)">
          <rect x="-8" y="-13" width="34" height="26" rx="3" fill="#120c07" />
          <rect x="22" y="-13" width="4" height="26" rx="1" fill="#3a2614" />
          <ellipse cx="26" cy="0" rx="3" ry="11" fill="#fff3d6" />
        </g>
        <line x1="372" y1="0" x2="372" y2="20" stroke="#120c07" strokeWidth="3" />
      </svg>
    </CoverFrame>
  );
}

/** Cover art for the game's tile on the GameHub page. */
export function ShadowGuessCover() {
  return <ShadowArt info={useDaily()} />;
}

/** One line for the GameHub tile: today's puzzle, and where the player stands on it. */
export function ShadowGuessStatus() {
  const info = useDaily();
  if (!info) return <span>A new puzzle every day</span>;
  return (
    <span>
      Daily #{info.puzzleNumber} · <span className={dailyDone(info) ? "text-moss-300" : "text-stone-200"}>{statusLine(info)}</span>
    </span>
  );
}

export function ShadowGuessHubCard() {
  const info = useDaily();
  const now = useNow();
  const done = dailyDone(info);

  return (
    <div className="grid gap-6 md:grid-cols-[1.05fr_1fr] md:gap-10">
      <ShadowArt info={info} />
      <div className="flex flex-col py-1 md:py-4">
        <p className="eyebrow">Today&rsquo;s puzzle</p>
        <h3 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Shadow Guess</h3>
        <p className="mt-3 text-stone-400">
          A hidden 3D object casts its shadow. Name it in as few angles as you can: every miss turns the light.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.08] text-sm">
          <div className="bg-stone-950/80 p-4">
            <dt className="text-stone-500">Status</dt>
            <dd className={`mt-1 font-medium ${done ? "text-moss-300" : "text-stone-100"}`}>
              {info ? statusLine(info) : <span className="inline-block h-4 w-28 animate-pulse rounded bg-white/10" />}
            </dd>
          </div>
          <div className="bg-stone-950/80 p-4">
            <dt className="text-stone-500">Next puzzle</dt>
            <dd className="mt-1 font-medium text-stone-100 tabular-nums">
              {info ? `in ${formatCountdown(info.nextAt, now)}` : <span className="inline-block h-4 w-20 animate-pulse rounded bg-white/10" />}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-auto md:pt-6">
          <Link to={SHADOW_GUESS_PATH} className="btn btn-primary flex-1">
            {dailyCta(info)}
            <span aria-hidden>→</span>
          </Link>
          <Link to={`${SHADOW_GUESS_PATH}?mode=free`} className="btn btn-secondary">
            Free play
          </Link>
        </div>
      </div>
    </div>
  );
}
