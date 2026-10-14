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
    <section ref={ref} className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b hairline">
      {/* The scene's edges fade into the page, so the 3D floor and the paper are one surface. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-paper [mask-image:radial-gradient(ellipse_70%_75%_at_62%_55%,black_50%,transparent_100%)]">
        <Suspense fallback={null}>
          <HubWorld active={visible} />
        </Suspense>
      </div>

      <div className="container-page self-start pt-[12svh] md:self-center md:pt-0">
        <div className="max-w-xl text-center md:text-left">
          <div className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-stone-950/50 py-1.5 pr-4 pl-3 label-mono text-stone-200 ring-1 ring-white/15 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-moss-400" />
              <span className="relative h-2 w-2 rounded-full bg-moss-400" />
            </span>
            {games.length} {games.length === 1 ? "game" : "games"} live <span className="text-stone-400">· more on the way</span>
          </div>
          <h1 className="mt-6 animate-rise text-display [animation-delay:80ms]">
            Tiny games.{" "}
            <span className="text-ember-500">Daily wins.</span>
          </h1>
          <p className="mt-5 max-w-md animate-rise text-lead [animation-delay:160ms] max-md:mx-auto">
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
          <p className="mt-5 animate-rise label-mono text-stone-500 [animation-delay:300ms]">
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
      className="group surface flex flex-col overflow-hidden p-3 transition duration-300 ease-mirai hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(60,45,20,0.45)] sm:p-4"
    >
      <div className="relative min-h-64 flex-1 [&>div]:h-full">
        <game.Cover />
      </div>
      <div className="flex flex-col gap-4 px-2 pt-5 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-light tracking-tight uppercase sm:text-3xl">{game.title}</h3>
          <p className="mt-1.5 font-serif text-stone-400">{game.tagline}</p>
          <p className="mt-3 label-mono text-stone-500">
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
    <div className="relative flex min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-sm border border-dashed border-white/25 p-6 md:col-span-2 md:flex-row md:items-center md:justify-start md:gap-6">
      <div className="relative grid h-14 w-14 place-items-center rounded-full ring-1 ring-white/25">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div className="relative">
        <p className="eyebrow text-stone-500!">Game {String(games.length + n).padStart(2, "0")}</p>
        <h3 className="mt-2 font-display text-xl font-light tracking-tight text-stone-300 uppercase">Coming soon</h3>
        <p className="mt-1 font-serif text-sm text-stone-500">In the workshop. Check back soon.</p>
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
          <Reveal key={title} delay={i * 90} className="border-t hairline pt-7 text-center md:text-left">
            <div className="mx-auto h-12 w-12 md:mx-0">
              <Icon />
            </div>
            <h3 className="mt-5 font-display text-lg font-medium tracking-tight uppercase">{title}</h3>
            <p className="mt-2 font-serif leading-relaxed text-stone-400">{body}</p>
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
      <Reveal className="relative isolate overflow-hidden border-y hairline px-6 py-16 text-center sm:py-20">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(217,88,44,0.16),transparent_55%)]" />
        <span aria-hidden className="mx-auto mb-6 block h-10 w-10 rounded-full bg-sun" />
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
