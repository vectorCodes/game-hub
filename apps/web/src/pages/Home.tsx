import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { games } from "../games/registry";
import { Lumi } from "../components/animated/Lumi";
import { ClockIcon, FlameIcon, GuessIcon, PodiumIcon, PointsIcon, ShadowIcon } from "../components/animated/icons";
import { dailyCta, SHADOW_GUESS_PATH, useDaily, useNow } from "../games/shadow-guess/useDaily";
import { formatCountdown } from "../lib/format";
import { useReveal } from "../lib/useReveal";

const STEPS = [
  { Icon: ShadowIcon, title: "Study the shadow", body: "A hidden 3D object casts its silhouette on a lit wall." },
  { Icon: GuessIcon, title: "Make a guess", body: "Wrong? The light turns and the shadow shows a new side." },
  { Icon: PointsIcon, title: "Solve it early", body: "Start at 100 points. Every extra angle costs you 15." },
];

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

/** A section that rises in when it scrolls into view. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-section">{title}</h2>
      {lead && <p className="mt-4 text-lead">{lead}</p>}
    </Reveal>
  );
}

/** Glass chip that floats beside the video on wide screens. */
function FloatingChip({ className, delay, children }: { className: string; delay: string; children: ReactNode }) {
  return (
    <div className={`pointer-events-none absolute z-10 hidden lg:block ${className}`}>
      <div className="animate-drift glass rounded-2xl px-4 py-3" style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The Shadow Guess promo, rendered from the Remotion project in /video. A plain MP4 keeps
 * three.js off the homepage. Reduced-motion users get the poster and must press play.
 */
function PromoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(!reducedMotion);
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  return (
    <div className="relative">
      {/* Stage glow behind the frame. */}
      <div aria-hidden className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgba(139,92,246,0.35),transparent_70%)] blur-2xl" />
      <div className="overflow-hidden rounded-[1.75rem] bg-stone-950 p-1.5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/10 sm:rounded-[2rem] sm:p-2">
        <video
          ref={video}
          src="/promo.mp4"
          poster="/promo-poster.jpg"
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="metadata"
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
    </div>
  );
}

function Hero() {
  const info = useDaily();
  const now = useNow();
  return (
    <section className="relative pt-10 pb-20 sm:pt-14 sm:pb-28">
      <div className="container-page">
        <div className="relative mx-auto max-w-3xl text-center">
          <Lumi className="absolute -top-6 -right-40 hidden h-44 w-44 xl:block" />

          <div className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-white/5 py-1.5 pr-4 pl-3 text-sm text-stone-300 ring-1 ring-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-cyan-400" />
              <span className="relative h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            {info ? (
              <span>
                Daily #{info.puzzleNumber} is live <span className="text-stone-500">· next in {formatCountdown(info.nextAt, now)}</span>
              </span>
            ) : (
              <span>A new puzzle every day</span>
            )}
          </div>

          <h1 className="mt-6 animate-rise text-display [animation-delay:80ms]">
            Can you name it from its{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-400 bg-clip-text text-transparent">shadow</span>?
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-rise text-lead [animation-delay:160ms]">
            A hidden 3D object casts its silhouette on the wall. Guess what it is. Every miss turns the light and reveals a new
            angle.
          </p>

          <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
            <Link to={SHADOW_GUESS_PATH} className="btn btn-primary w-full sm:w-auto">
              {dailyCta(info)}
              <span aria-hidden>→</span>
            </Link>
            <Link to={`${SHADOW_GUESS_PATH}?mode=free`} className="btn btn-secondary w-full sm:w-auto">
              Free play
            </Link>
          </div>
          <p className="mt-4 animate-rise text-sm text-stone-500 [animation-delay:300ms]">Free to play · No sign-up needed · About 2 minutes</p>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl animate-rise [animation-delay:380ms] sm:mt-14">
          <FloatingChip className="top-[18%] -left-16" delay="0s">
            <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Angle</div>
            <div className="mt-0.5 font-display text-2xl font-bold tabular-nums">
              1 <span className="text-stone-500">/ 6</span>
            </div>
          </FloatingChip>
          <FloatingChip className="top-[46%] -right-20" delay="-2.5s">
            <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Worth</div>
            <div className="mt-0.5 font-display text-2xl font-bold text-cyan-300 tabular-nums">100</div>
          </FloatingChip>
          <FloatingChip className="-bottom-7 left-[18%]" delay="-4.5s">
            <div className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">✓</span>
              <span>
                <span className="font-semibold">Reindeer</span> <span className="text-stone-400">· solved in 3 angles</span>
              </span>
            </div>
          </FloatingChip>
          <PromoVideo />
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="container-page">
      <Reveal>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/[0.08] md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-stone-950 px-6 py-8 text-center sm:py-10">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <div className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{s.value}</div>
                <div className="mt-2 text-sm text-stone-400">{s.label}</div>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="container-page py-24 sm:py-32">
      <SectionHeader eyebrow="How to play" title="Three steps. One shadow. Two minutes." />
      <ol className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 90} className="surface h-full p-7 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="h-16 w-16">
                  <Icon />
                </div>
                <span className="font-display text-sm font-semibold text-stone-600 tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-7 font-display text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 leading-relaxed text-stone-400">{body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayNow() {
  return (
    <section className="container-page">
      <SectionHeader eyebrow="Play now" title="Today's shadow is waiting." lead="Everyone gets the same puzzle. See how you stack up." />
      <div className="mt-14 space-y-5">
        {games.map((g) => (
          <Reveal key={g.id}>
            <article className="surface p-3 sm:p-4">
              <g.HubCard />
            </article>
          </Reveal>
        ))}
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-2 rounded-3xl border border-dashed border-white/10 px-6 py-5 text-center sm:flex-row sm:text-left">
            <p className="font-medium text-stone-300">More daily games are on the way.</p>
            <p className="text-sm text-stone-500">GameHub is growing. One quick puzzle at a time.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="container-page py-24 sm:py-32">
      <SectionHeader eyebrow="Make it a habit" title="Built for one great minute a day." />
      <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 90} className="text-center md:text-left">
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

function FinalCta() {
  const info = useDaily();
  return (
    <section className="container-page pb-24 sm:pb-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-600/15 to-transparent px-6 py-14 ring-1 ring-white/10 sm:px-14 sm:py-16">
          <div aria-hidden className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-section">Tomorrow&rsquo;s shadow is already cast.</h2>
              <p className="mt-4 max-w-lg text-lead">Solve today&rsquo;s puzzle, start your streak, and come back for the next one.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={SHADOW_GUESS_PATH} className="btn btn-primary">
                  {dailyCta(info)}
                  <span aria-hidden>→</span>
                </Link>
                <Link to="/leaderboard" className="btn btn-secondary">
                  View leaderboard
                </Link>
              </div>
            </div>
            <Lumi className="mx-auto h-44 w-44 md:h-56 md:w-56" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <HowItWorks />
      <PlayNow />
      <Features />
      <FinalCta />
    </>
  );
}
