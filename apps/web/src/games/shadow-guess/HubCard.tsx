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

/** The chair, in local units: base at y = 0, up is negative. */
const CHAIR = (
  <>
    <rect x="0" y="-84" width="7" height="84" />
    <rect x="0" y="-40" width="44" height="7" />
    <rect x="37" y="-40" width="7" height="40" />
    <rect x="0" y="-76" width="7" height="5" />
  </>
);

/**
 * A red sun low on the right, a chair drawn in outline on the horizon, and its long ink
 * shadow stretched across the floor toward us, leaning slowly as the light moves.
 */
function ShadowArt({ info }: { info: DailyInfo | null }) {
  return (
    <CoverFrame
      number="01"
      title="Shadow Guess"
      meta={info ? `Daily #${info.puzzleNumber}` : "Daily"}
      caption={info?.theme ? `${info.theme.name}` : "Name it from its shadow"}
      className="aspect-[16/10] md:aspect-auto"
    >
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
        {/* The sun and its ray to the chair. */}
        <circle cx="318" cy="66" r="30" fill="#d9582c" />
        <line x1="296" y1="84" x2="214" y2="112" stroke="#2a2216" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />
        {/* Horizon and floor rules. */}
        <line x1="0" y1="156" x2="400" y2="156" stroke="#2a2216" strokeOpacity="0.35" strokeWidth="1" />
        {[176, 200, 226].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#2a2216" strokeOpacity="0.08" strokeWidth="1" />
        ))}
        {/* The shadow on the floor, falling away from the sun. */}
        <g transform="translate(170 156) matrix(1 0 0.9 -0.42 0 0)">
          <g className="cover-sway" fill="#2a2216" fillOpacity="0.9">
            {CHAIR}
          </g>
        </g>
        {/* The chair itself, in outline. */}
        <g transform="translate(170 156)" fill="none" stroke="#2a2216" strokeWidth="1.6">
          <rect x="0.8" y="-84" width="5.4" height="84" />
          <rect x="0.8" y="-40" width="42.4" height="5.4" />
          <rect x="37.8" y="-40" width="5.4" height="40" />
        </g>
        {/* Annotation, as on a technical plate. */}
        <text x="18" y="148" fontFamily="Azeret Mono, monospace" fontSize="8" letterSpacing="1.2" fill="#2a2216" fillOpacity="0.55">
          ANGLE 1 / 6
        </text>
        <circle cx="214" cy="112" r="2.5" fill="#cc922f" />
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
