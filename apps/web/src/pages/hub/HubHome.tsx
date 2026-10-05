// GameHub's front page: a 3D hero, then the lineup of games. Each game tile opens that
// game's own landing page.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ClockIcon, FlameIcon, PodiumIcon } from "../../components/animated/icons";
import { Reveal } from "../../components/Reveal";
import { games, type GameEntry } from "../../games/registry";
import { preloadLandingModels } from "../landing/assets";

// three.js loads after the page's text: the scene fades in behind it.
const HubWorld = lazy(() => import("./HubWorld"));

/** Coming-soon slots, until the next games arrive. */
const UPCOMING = 1;

const FEATURES = [
  { Icon: ClockIcon, title: "Bite-size, every day", body: "Fresh puzzles daily, a couple of minutes each. Play as a guest: no sign-up needed." },
  { Icon: FlameIcon, title: "One account, every game", body: "Sign in once with Google. Your streaks and stats follow you from game to game." },
  { Icon: PodiumIcon, title: "Beat your friends", body: "Everyone gets the same daily puzzle. Daily, weekly and all-time leaderboards." },
];

/** Whether an element is on screen, so the 3D scene can stop rendering once it's scrolled away. */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Hero() {
  const { ref, visible } = useOnScreen<HTMLElement>();
  const [first] = games;
  // The scene's models download alongside the 3D bundle, rather than after it.
  useEffect(preloadLandingModels, []);

  return (
    <section ref={ref} className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_65%_45%,#1d2c23,#0e1411_70%)]">
        <Suspense fallback={null}>
          <HubWorld active={visible} />
        </Suspense>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-stone-950 to-transparent" />

      <div className="container-page self-start pt-[12svh] md:self-center md:pt-0">
        <div className="max-w-xl text-center md:text-left">
          <div className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-stone-950/50 py-1.5 pr-4 pl-3 text-sm text-stone-200 ring-1 ring-white/10 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-moss-400" />
              <span className="relative h-2 w-2 rounded-full bg-moss-400" />
            </span>
            {games.length} {games.length === 1 ? "game" : "games"} live <span className="text-stone-400">· more on the way</span>
          </div>
          <h1 className="mt-6 animate-rise text-display text-legible [animation-delay:80ms]">
            Tiny games.{" "}
            <span className="bg-linear-to-r from-lamp-200 via-lamp-300 to-lamp-500 bg-clip-text text-transparent text-shadow-none">
              Daily wins.
            </span>
          </h1>
          <p className="mt-5 max-w-md animate-rise text-lead text-legible text-stone-300! [animation-delay:160ms] max-md:mx-auto">
            GameHub is a home for quick, clever games. A fresh challenge every day, a few minutes each, and a
            leaderboard to climb.
          </p>
          <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:240ms] sm:flex-row max-md:justify-center">
            <Link to={first.path} className="btn btn-primary">
              Play {first.title}
              <span aria-hidden>→</span>
            </Link>
            <a href="#games" className="btn btn-secondary backdrop-blur-md">
              Browse games
            </a>
          </div>
          <p className="mt-4 animate-rise text-sm text-stone-400 text-legible [animation-delay:300ms]">
            Free to play · No sign-up needed · New puzzles every day
          </p>
        </div>
      </div>
    </section>
  );
}

function GameTile({ game }: { game: GameEntry }) {
  return (
    <Link
      to={game.path}
      className="group glass flex flex-col overflow-hidden rounded-4xl p-3 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-30px_rgba(244,185,78,0.35)] sm:p-4"
    >
      <div className="relative min-h-64 flex-1 [&>div]:h-full">
        <game.Cover />
      </div>
      <div className="flex flex-col gap-4 px-2 pt-5 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{game.title}</h3>
          <p className="mt-1.5 text-stone-400">{game.tagline}</p>
          <p className="mt-3 text-sm text-stone-400">
            <game.Status />
          </p>
        </div>
        <span className="btn btn-primary shrink-0">
          Open
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

/** A locked slot for a game that's still being built. */
function ComingSoonTile({ n }: { n: number }) {
  return (
    <div className="relative flex min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-4xl border md:col-span-2 md:flex-row md:items-center md:justify-start md:gap-6 border-dashed border-white/15 p-6 [background:repeating-linear-gradient(135deg,rgba(255,255,255,0.025)_0_12px,transparent_12px_24px)]">
      <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-lamp-400/10 blur-3xl" />
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div className="relative">
        <p className="eyebrow text-stone-500!">Game {String(games.length + n).padStart(2, "0")}</p>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-stone-300">Coming soon</h3>
        <p className="mt-1 text-sm text-stone-500">In the workshop. Check back soon.</p>
      </div>
    </div>
  );
}

function Lineup() {
  return (
    <section id="games" className="container-page scroll-mt-20 py-24 sm:py-32">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">The lineup</p>
        <h2 className="mt-4 text-section">Pick a game.</h2>
        <p className="mt-4 text-lead">Each one takes a few minutes and comes back with a new challenge every day.</p>
      </Reveal>
      <Reveal delay={100} className="mt-12">
        <div className="grid gap-5 md:grid-cols-2">
          {games.map((g) => (
            <GameTile key={g.id} game={g} />
          ))}
          {Array.from({ length: UPCOMING }, (_, i) => (
            <ComingSoonTile key={i} n={i + 1} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Features() {
  return (
    <section className="container-page pb-24 sm:pb-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Why GameHub</p>
        <h2 className="mt-4 text-section">One hub. Every game.</h2>
      </Reveal>
      <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 90} className="surface p-7 text-center md:text-left">
            <div className="mx-auto h-12 w-12 md:mx-0">
              <Icon />
            </div>
            <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 leading-relaxed text-stone-400">{body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Finale() {
  const [first] = games;
  return (
    <section className="container-page pb-28">
      <Reveal className="relative overflow-hidden rounded-4xl px-6 py-16 text-center ring-1 ring-white/10 sm:py-20">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(244,185,78,0.18),transparent_70%)]" />
        <h2 className="text-section">Today&rsquo;s puzzle is waiting.</h2>
        <p className="mx-auto mt-4 max-w-md text-lead">Start with {first.title}. More games are on the way.</p>
        <Link to={first.path} className="btn btn-primary mt-8">
          Play {first.title}
          <span aria-hidden>→</span>
        </Link>
      </Reveal>
    </section>
  );
}

export default function HubHome() {
  return (
    <>
      <Hero />
      <Lineup />
      <Features />
      <Finale />
    </>
  );
}
