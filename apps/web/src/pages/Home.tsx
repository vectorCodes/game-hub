import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { games } from "../games/registry";
import { ClockIcon, FlameIcon, PodiumIcon } from "../components/animated/icons";
import { dailyCta, SHADOW_GUESS_PATH, useDaily, useNow } from "../games/shadow-guess/useDaily";
import { formatCountdown } from "../lib/format";
import { useReveal } from "../lib/useReveal";
import { preloadLandingModels } from "./landing/assets";
import { useJourney } from "./landing/journey";

// three.js loads after the page's text: the world fades in behind it.
const World = lazy(() => import("./landing/World"));

const FEATURES = [
  { Icon: FlameIcon, title: "Keep a daily streak", body: "One puzzle a day. Sign in with Google to keep your run going." },
  { Icon: PodiumIcon, title: "Climb the leaderboard", body: "Daily, weekly and all-time ranks. Fewer angles, higher place." },
  { Icon: ClockIcon, title: "Two minutes, no sign-up", body: "Play instantly as a guest. Your games move over when you sign in." },
];

const STATS = [
  { value: "80+", label: "hand-picked objects" },
  { value: "6", label: "light angles per puzzle" },
  { value: "1", label: "new puzzle every day" },
  { value: "100", label: "points for a first-angle solve" },
];

/** Rises in when it scrolls into view. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** One stop on the journey: the 3D camera arrives here when this section is centred. */
function Chapter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section data-chapter className={`relative flex min-h-[100svh] items-center py-24 ${className}`}>
      <div className="container-page w-full">{children}</div>
    </section>
  );
}

function ChapterLabel({ n, children, center = false }: { n: string; children: ReactNode; center?: boolean }) {
  return (
    <p className={`eyebrow flex items-center gap-3 text-legible ${center ? "justify-center" : ""}`}>
      <span className="font-display text-lamp-300 tabular-nums">{n}</span>
      <span className="h-px w-8 bg-moss-300/50" />
      {children}
    </p>
  );
}

/**
 * The Shadow Guess promo, rendered from the Remotion project in /video (≈6 MB). Nothing is
 * downloaded until it's about to scroll into view; it plays (muted) only while visible and
 * pauses when it leaves. "Sound on" restarts it with audio. Reduced-motion users press play.
 */
function PromoVideo() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // The visitor paused it themselves: don't restart it when it scrolls back into view.
  const userPaused = useRef(false);

  // Attach the source once the player is within ~one screen of the viewport.
  useEffect(() => {
    const el = frame.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // Play while at least 40% visible; pause when scrolled away.
  useEffect(() => {
    const el = frame.current;
    if (!el || !near || reducedMotion) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const v = video.current;
        if (!v) return;
        if (e.intersectionRatio >= 0.4) {
          if (!userPaused.current) void v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, reducedMotion]);
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    userPaused.current = !v.paused;
    if (v.paused) void v.play();
    else v.pause();
  };
  // React doesn't keep the `muted` attribute in sync, so it's set on the element directly.
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !muted;
    if (muted) {
      v.currentTime = 0;
      userPaused.current = false;
      void v.play();
    }
    setMuted(!muted);
  };
  return (
    <div ref={frame} className="relative">
      <div className="overflow-hidden rounded-[1.75rem] bg-stone-950 p-1.5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/10 sm:rounded-[2rem] sm:p-2">
        <video
          ref={video}
          src={near ? "/promo.mp4" : undefined}
          poster={near ? "/promo-poster.jpg" : undefined}
          muted
          loop
          playsInline
          preload={near ? "metadata" : "none"}
          aria-label="Shadow Guess trailer"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="block aspect-video w-full rounded-[1.35rem] bg-stone-950 sm:rounded-[1.5rem]"
        />
      </div>
      <button
        onClick={toggle}
        aria-label={playing ? "Pause trailer" : "Play trailer"}
        className="glass absolute bottom-5 left-5 grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-stone-900 sm:bottom-7 sm:left-7"
      >
        {playing ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M4 2.8v10.4a.8.8 0 0 0 1.2.7l8.4-5.2a.8.8 0 0 0 0-1.4L5.2 2.1a.8.8 0 0 0-1.2.7z" />
          </svg>
        )}
      </button>
      <button
        onClick={toggleSound}
        aria-label={muted ? "Play trailer with sound" : "Mute trailer"}
        className="glass absolute right-5 bottom-5 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-white transition hover:bg-stone-900 sm:right-7 sm:bottom-7"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8v4h3l4 3.5v-11L6 8H3z" fill="currentColor" />
          {muted ? <path d="M13.5 7.5l4 5m0-5l-4 5" /> : <path d="M13.5 7a4 4 0 0 1 0 6M15.5 5a7 7 0 0 1 0 10" />}
        </svg>
        <span className="hidden sm:inline">{muted ? "Sound on" : "Mute"}</span>
      </button>
    </div>
  );
}

function Hero() {
  const info = useDaily();
  const now = useNow();
  return (
    <Chapter className="items-start pt-[14svh]">
      <div className="relative mx-auto max-w-3xl text-center">
        <div aria-hidden className="absolute -inset-x-24 -inset-y-16 -z-10 bg-[radial-gradient(ellipse_closest-side,rgba(14,20,17,0.62),transparent)]" />
        <div className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-stone-950/50 py-1.5 pr-4 pl-3 text-sm text-stone-200 ring-1 ring-white/10 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-moss-400" />
            <span className="relative h-2 w-2 rounded-full bg-moss-400" />
          </span>
          {info ? (
            <span>
              Daily #{info.puzzleNumber} is live <span className="text-stone-400">· next in {formatCountdown(info.nextAt, now)}</span>
            </span>
          ) : (
            <span>A new puzzle every day</span>
          )}
        </div>
        <h1 className="mt-6 animate-rise text-display text-legible [animation-delay:80ms]">
          Can you name it from its{" "}
          <span className="bg-gradient-to-r from-lamp-200 via-lamp-300 to-lamp-500 bg-clip-text text-transparent [text-shadow:none]">shadow</span>?
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-rise text-lead text-legible text-stone-300! [animation-delay:160ms]">
          A hidden 3D object casts its silhouette on the wall. Every miss turns the light and reveals a new angle.
        </p>
        <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
          <Link to={SHADOW_GUESS_PATH} className="btn btn-primary w-full sm:w-auto">
            {dailyCta(info)}
            <span aria-hidden>→</span>
          </Link>
          <Link to={`${SHADOW_GUESS_PATH}?mode=free`} className="btn btn-secondary w-full backdrop-blur-md sm:w-auto">
            Free play
          </Link>
        </div>
        <p className="mt-4 animate-rise text-sm text-stone-400 text-legible [animation-delay:300ms]">Free to play · No sign-up needed · About 2 minutes</p>
      </div>

      {/* Scroll cue. */}
      <div className="absolute inset-x-0 bottom-8 flex animate-fade flex-col items-center gap-3 text-xs font-medium tracking-[0.2em] text-stone-400 uppercase [animation-delay:900ms]">
        Scroll to explore
        <span className="relative h-10 w-6 rounded-full ring-1 ring-stone-400/60">
          <span className="absolute top-2 left-1/2 h-2 w-1 -translate-x-1/2 animate-scroll-cue rounded-full bg-lamp-300" />
        </span>
      </div>
    </Chapter>
  );
}

function StudyChapter() {
  return (
    <Chapter>
      <Reveal className="max-w-md">
        <ChapterLabel n="01">Study</ChapterLabel>
        <h2 className="mt-5 text-section text-legible">Every object leaves a shadow.</h2>
        <p className="mt-5 text-lead text-legible text-stone-300!">
          Somewhere between the lantern and the wall stands a hidden object. All you get is its silhouette. Keep scrolling and
          watch the light turn.
        </p>
      </Reveal>
    </Chapter>
  );
}

function GuessChapter() {
  return (
    <Chapter>
      <div className="flex">
        <Reveal className="glass w-full max-w-md rounded-[2rem] p-7 sm:p-9">
          <ChapterLabel n="02">Guess</ChapterLabel>
          <h2 className="mt-5 text-section text-legible">Every miss turns the light.</h2>
          <p className="mt-5 text-lead text-legible text-stone-300!">
            Six angles, hardest first. Each wrong guess shows a new side, and costs you 15 points.
          </p>
          <div className="mt-8 rounded-2xl bg-stone-950/60 p-5 ring-1 ring-white/[0.08] sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Angle</div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                  3 <span className="text-stone-500">/ 6</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Worth</div>
                <div className="mt-1 font-display text-3xl font-bold text-moss-300 tabular-nums text-glow">70</div>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-white/[0.08] text-sm">
              <li className="flex justify-between py-2.5 text-stone-500 line-through decoration-ember-400/60">
                Potato <span className="text-ember-300 no-underline">Miss</span>
              </li>
              <li className="flex justify-between py-2.5 text-stone-500 line-through decoration-ember-400/60">
                Rock <span className="text-ember-300 no-underline">Miss</span>
              </li>
              <li className="flex justify-between py-2.5 font-medium text-stone-100">
                Reindeer <span className="text-moss-300">Correct</span>
              </li>
            </ul>
          </div>
        </Reveal>
      </div>
    </Chapter>
  );
}

function TrailerChapter() {
  return (
    <Chapter>
      <Reveal className="mx-auto max-w-2xl text-center">
        <ChapterLabel n="03" center>
          Watch
        </ChapterLabel>
        <h2 className="mt-5 text-section text-legible">Forty-five seconds of shadows.</h2>
      </Reveal>
      <Reveal className="mx-auto mt-10 max-w-4xl" delay={120}>
        <PromoVideo />
      </Reveal>
    </Chapter>
  );
}

function GladeChapter() {
  return (
    <Chapter className="items-stretch">
      <div className="flex h-full min-h-[calc(100svh-12rem)] flex-col justify-between">
        <Reveal className="mx-auto max-w-2xl text-center">
          <ChapterLabel n="04" center>
            Collect
          </ChapterLabel>
          <h2 className="mt-5 text-section text-legible">Eighty objects. One a day.</h2>
          <p className="mt-4 text-lead text-legible text-stone-300!">Chairs, cacti, snowmen, spaceships. Every one hand-picked to cast a tricky shadow.</p>
        </Reveal>
        <Reveal delay={120}>
          <dl className="glass mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-7 text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <div className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{s.value}</div>
                  <div className="mt-2 text-sm text-stone-400">{s.label}</div>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Chapter>
  );
}

function FinaleChapter() {
  const info = useDaily();
  return (
    <Chapter className="pt-[30svh]">
      <Reveal className="mx-auto max-w-2xl text-center">
        <ChapterLabel n="05" center>
          Play
        </ChapterLabel>
        <h2 className="mt-5 text-display text-legible">Tonight&rsquo;s shadow is waiting.</h2>
        <p className="mt-5 text-lead text-legible text-stone-300!">Everyone gets the same puzzle. Solve it in fewer angles than your friends.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={SHADOW_GUESS_PATH} className="btn btn-primary">
            {dailyCta(info)}
            <span aria-hidden>→</span>
          </Link>
          <Link to="/leaderboard" className="btn btn-secondary backdrop-blur-md">
            View leaderboard
          </Link>
        </div>
      </Reveal>

      <div className="mt-24 space-y-5">
        {games.map((g) => (
          <Reveal key={g.id}>
            <article className="glass rounded-3xl p-3 sm:p-4">
              <g.HubCard />
            </article>
          </Reveal>
        ))}
      </div>

      <div className="mt-20 grid gap-x-10 gap-y-12 md:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 90} className="text-center md:text-left">
            <div className="mx-auto h-12 w-12 md:mx-0">
              <Icon />
            </div>
            <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-legible">{title}</h3>
            <p className="mt-2 leading-relaxed text-stone-300 text-legible">{body}</p>
          </Reveal>
        ))}
      </div>
    </Chapter>
  );
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  useJourney(root);
  // Models download alongside the 3D bundle (which React.lazy already started).
  useEffect(preloadLandingModels, []);
  return (
    <div ref={root} className="relative">
      {/* The 3D world sits fixed behind every chapter; the camera follows the scroll. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_30%,#1d2c23,#0e1411_70%)]">
        <Suspense fallback={null}>
          <World />
        </Suspense>
      </div>
      <Hero />
      <StudyChapter />
      <GuessChapter />
      <TrailerChapter />
      <GladeChapter />
      <FinaleChapter />
    </div>
  );
}
