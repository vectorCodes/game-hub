import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Reveal } from "../../components/Reveal";
import { games } from "../../games/registry";
import { msToNextDaily, splitClock } from "./scroll";

function useNextDaily() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return splitClock(msToNextDaily(now));
}

/** The ticking boxes. Its own component, so the once-a-second re-render stays this small. */
function Countdown() {
  const t = useNextDaily();
  const units: [string, string][] = [
    ["Hrs", t.h],
    ["Min", t.m],
    ["Sec", t.s],
  ];
  return (
    <div className="mt-3 flex gap-2 md:gap-3" role="timer" aria-label={`${Number(t.h)} hours, ${Number(t.m)} minutes until the next daily`}>
      {units.map(([label, v]) => (
        <div key={label} className="brackets min-w-[4.25rem] px-3 py-3 text-center text-stone-100/30 md:min-w-[5.5rem]">
          <span className="block font-display text-[1.75rem] font-extrabold tracking-tight text-stone-100 tabular-nums md:text-[2.75rem]">{v}</span>
          <span className="mt-1 block label-mono text-stone-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The close: a ticking countdown to the next daily on one side, today's games and where
 * each one stands on the other.
 */
export function Today() {
  return (
    <section id="today" aria-labelledby="today-title" className="relative overflow-hidden pb-28 md:pb-40">
      {/* A sliver of the sun rising at the bottom edge: the hero, bookended. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[62vw] left-1/2 size-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgb(217_88_44/0.26),rgb(232_196_120/0.05)_45%,transparent_68%)]"
      />

      <div className="container-page relative">
        <div className="grid gap-12 border-t hairline pt-20 md:grid-cols-2 md:gap-16 md:pt-28">
          <Reveal>
            <p className="eyebrow">Today</p>
            <h2 id="today-title" className="mt-4 text-section">
              Today&rsquo;s dailies are waiting.
            </h2>
            <p className="mt-5 max-w-[28rem] text-lead">Same challenge for everyone, a few minutes each. Play as a guest, or sign in to keep the streak.</p>

            <div className="mt-10">
              <p className="label-mono text-stone-500">Next daily in · 00:00 UTC</p>
              <Countdown />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <ol className="divide-y divide-stone-100/15 border-y hairline">
              {games.map((g, i) => (
                <li key={g.id} data-game={g.id}>
                  <Link to={g.path} className="group flex items-center gap-4 px-2 py-5 transition-colors hover:bg-stone-100/[0.04]">
                    <span className="label-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl font-bold tracking-tight">{g.title}</span>
                      <span className="mt-1 block label-mono text-stone-500">
                        <g.Status />
                      </span>
                    </span>
                    <span aria-hidden className="font-display font-bold text-accent transition-transform group-hover:translate-x-1">
                      Play →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-stone-500">Free to play · No sign-up needed · New challenges every day</p>
        </Reveal>
        </div>
      </div>
    </section>
  );
}
