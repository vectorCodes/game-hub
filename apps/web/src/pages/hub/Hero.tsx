// The hub's front, all on one screen: GameHub in big type, today's dailies one click away,
// and every game as a lit card, each in its own colour. Pointing at a card lights the page
// in that game's glow.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LivePill } from "../../components/landing";
import { games } from "../../games/registry";
import { gsap, SplitText, useGsap } from "../../lib/motion";
import { msToNextDaily, splitClock } from "./scroll";

/** Hours and minutes to the next daily, refreshed every half minute. */
function useNextDaily() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return splitClock(msToNextDaily(now));
}

export function Hero() {
  const next = useNextDaily();
  const [lit, setLit] = useState<string | null>(null);

  const ref = useGsap<HTMLElement>((root, reduced) => {
    if (reduced) return;
    const split = SplitText.create(root.querySelector("[data-title]"), { type: "chars", mask: "chars" });
    gsap.from(split.chars, { yPercent: 115, rotate: 8, duration: 1, ease: "back.out(1.6)", stagger: 0.05 });
    gsap.from("[data-rise]", { y: 24, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, delay: 0.35 });
    gsap.from("[data-card]", { y: 60, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.5 });
  });

  return (
    <section ref={ref} aria-labelledby="hub-title" className="relative isolate overflow-hidden">
      {/* One glow per game, at the top of the page; the one you're pointing at fades in. */}
      {games.map((g) => (
        <div
          key={g.id}
          data-game={g.id}
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70rem_36rem_at_50%_-6rem,color-mix(in_oklch,var(--glow)_24%,transparent),transparent)] transition-opacity duration-700 ${
            lit === g.id ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      <div className="container-page pt-14 sm:pt-20">
        <LivePill>
          {games.length} dailies live · next in {Number(next.h)}h {next.m}m
        </LivePill>
        <h1 id="hub-title" data-title className="mt-6 text-display [font-size:clamp(4rem,1.5rem+11vw,12rem)]">
          Game<span className="text-accent">Hub</span>
        </h1>
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p data-rise className="max-w-xl text-lead">
            {games.length} small games, each with a new challenge every day. The same one for everyone, a few minutes each, free in your browser.
          </p>
          <div data-rise className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <a href="#today" className="btn btn-primary">
              Play today&rsquo;s dailies <span aria-hidden>↓</span>
            </a>
            <Link to="/leaderboard" className="btn btn-secondary">
              Leaderboard
            </Link>
          </div>
        </div>
      </div>

      <ul className="container-page mt-14 grid gap-4 pb-24 sm:mt-20 sm:grid-cols-2 lg:grid-cols-6">
        {games.map((g, i) => (
          <li
            key={g.id}
            data-card
            data-game={g.id}
            className={i < 2 ? "lg:col-span-3" : "lg:col-span-2"}
            onPointerEnter={() => setLit(g.id)}
            onPointerLeave={() => setLit((l) => (l === g.id ? null : l))}
          >
            <Link
              to={g.path}
              onFocus={() => setLit(g.id)}
              className="group surface flex h-full flex-col p-2.5 transition-[transform,box-shadow] duration-300 ease-mirai hover:-translate-y-1.5 hover:shadow-[inset_0_0_0_2px_var(--accent),0_30px_80px_-30px_color-mix(in_oklch,var(--glow)_65%,transparent)]"
            >
              <div className={`relative overflow-hidden rounded-[calc(var(--radius-ui)-4px)] *:h-full *:min-h-0! *:rounded-none! ${i < 2 ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
                <g.Cover />
              </div>
              <div className="flex flex-1 flex-col px-3 pt-5 pb-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-3xl font-bold tracking-tight">{g.title}</h2>
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p className="mt-2 text-stone-400">{g.tagline}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="min-w-0 truncate label-mono text-stone-500">
                    <g.Status />
                  </span>
                  <span className="shrink-0 font-display font-bold text-accent transition-transform duration-300 group-hover:translate-x-1">Play →</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
