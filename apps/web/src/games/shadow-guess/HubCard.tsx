// Hub card body for Shadow Guess: today's puzzle, the player's status, and a countdown.
// Kept free of three.js so the homepage stays light.
import { Link } from "react-router";
import type { DailyInfo } from "@shadow/shared";
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

/** A chair's shadow on the lit wall, leaning as if its light were circling. */
function ShadowArt({ puzzleNumber }: { puzzleNumber?: number }) {
  return (
    <div className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-2xl bg-wall md:aspect-auto md:h-full md:min-h-80">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_45%,#fffaf0,transparent_70%),radial-gradient(ellipse_90%_90%_at_50%_50%,transparent_55%,rgba(22,32,27,0.35))]"
      />
      <svg viewBox="0 0 100 100" className="relative h-36 w-36 origin-bottom animate-sway sm:h-44 sm:w-44" aria-hidden="true">
        <g fill="#16201b" opacity="0.92">
          <rect x="30" y="10" width="7" height="85" rx="1.5" />
          <rect x="30" y="52" width="42" height="7" rx="1.5" />
          <rect x="65" y="52" width="7" height="43" rx="1.5" />
          <rect x="30" y="18" width="7" height="5" rx="1" />
        </g>
      </svg>
      <span className="absolute top-4 left-4 rounded-full bg-stone-950/80 px-3 py-1 text-xs font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur">
        {puzzleNumber ? `Daily #${puzzleNumber}` : "Daily"}
      </span>
      <span className="absolute top-4 right-4 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">3D</span>
    </div>
  );
}

export function ShadowGuessHubCard() {
  const info = useDaily();
  const now = useNow();
  const done = dailyDone(info);

  return (
    <div className="grid gap-6 md:grid-cols-[1.05fr_1fr] md:gap-10">
      <ShadowArt puzzleNumber={info?.puzzleNumber} />
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
