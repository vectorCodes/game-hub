import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ShadowGuessHubCard } from "../games/shadow-guess/HubCard";
import { ClockIcon, FlameIcon, PodiumIcon } from "../components/animated/icons";
import { dailyCta, SHADOW_GUESS_PATH, useDaily, useNow } from "../games/shadow-guess/useDaily";
import { formatCountdown } from "../lib/format";
import { Reveal } from "../components/Reveal";
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
  { value: "150+", label: "hand-picked objects" },
  { value: "6", label: "light angles per puzzle" },
  { value: "1", label: "new puzzle every day" },
  { value: "100", label: "points for a first-angle solve" },
];

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
      <span className="h-px w-8 bg-lamp-300/50" />
      {children}
    </p>
  );
}

function Hero() {
  const info = useDaily();
  const now = useNow();
  return (
    <Chapter className="items-start pt-[14svh]">
      <div className="relative mx-auto max-w-3xl text-center">
        <div aria-hidden className="absolute -inset-x-24 -inset-y-16 -z-10 bg-[radial-gradient(ellipse_closest-side,rgba(243,234,217,0.75),transparent)]" />
        <div className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-stone-950/50 py-1.5 pr-4 pl-3 label-mono text-stone-200 ring-1 ring-white/15 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-moss-400" />
            <span className="relative h-2 w-2 rounded-full bg-moss-400" />
          </span>
          {info ? (
            <span>
              {info.theme && (
                <span className="font-medium text-lamp-200">
                  {info.theme.emoji} {info.theme.name} ·{" "}
                </span>
              )}
              Daily #{info.puzzleNumber} is live <span className="text-stone-400">· next in {formatCountdown(info.nextAt, now)}</span>
            </span>
          ) : (
            <span>A new puzzle every day</span>
          )}
        </div>
        <h1 className="mt-6 animate-rise text-display text-legible [animation-delay:80ms]">
          Can you name it from its{" "}
          <span className="text-ember-500">shadow</span>?
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
        <p className="mt-5 animate-rise label-mono text-stone-400 text-legible [animation-delay:300ms]">Free to play · No sign-up needed · About 2 minutes</p>
      </div>

      {/* Scroll cue. */}
      <div className="absolute inset-x-0 bottom-8 flex animate-fade flex-col items-center gap-3 label-mono text-stone-400 [animation-delay:900ms]">
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
        <Reveal className="glass w-full max-w-md p-7 sm:p-9">
          <ChapterLabel n="02">Guess</ChapterLabel>
          <h2 className="mt-5 text-section text-legible">Every miss turns the light.</h2>
          <p className="mt-5 text-lead text-legible text-stone-300!">
            Six angles, hardest first. Each wrong guess shows a new side, and costs you 15 points.
          </p>
          <div className="mt-8 rounded-xs bg-stone-950/60 p-5 ring-1 ring-white/12 sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="label-mono text-stone-400">Angle</div>
                <div className="mt-1 font-display text-2xl font-light tabular-nums">
                  3 <span className="text-stone-500">/ 6</span>
                </div>
              </div>
              <div className="text-right">
                <div className="label-mono text-stone-400">Worth</div>
                <div className="mt-1 font-display text-3xl font-light text-lamp-300 tabular-nums">70</div>
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

function GladeChapter() {
  return (
    <Chapter className="items-stretch">
      <div className="flex h-full min-h-[calc(100svh-12rem)] flex-col justify-between">
        <Reveal className="mx-auto max-w-2xl text-center">
          <ChapterLabel n="03" center>
            Collect
          </ChapterLabel>
          <h2 className="mt-5 text-section text-legible">150+ objects. One a day.</h2>
          <p className="mt-4 text-lead text-legible text-stone-300!">Chairs, cacti, snowmen, spaceships. Every one hand-picked to cast a tricky shadow.</p>
        </Reveal>
        <Reveal delay={120}>
          <dl className="glass mt-10 grid grid-cols-2 divide-white/12 overflow-hidden md:grid-cols-4 md:divide-x">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-7 text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <div className="font-display text-4xl font-light tracking-tight sm:text-5xl">{s.value}</div>
                  <div className="mt-2 label-mono text-stone-400">{s.label}</div>
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
        <ChapterLabel n="04" center>
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
        <Reveal>
          <article className="glass p-3 sm:p-4">
            <ShadowGuessHubCard />
          </article>
        </Reveal>
      </div>

      <div className="mt-20 grid gap-x-10 gap-y-12 md:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 90} className="text-center md:text-left">
            <div className="mx-auto h-12 w-12 md:mx-0">
              <Icon />
            </div>
            <h3 className="mt-5 font-display text-lg font-medium tracking-tight uppercase text-legible">{title}</h3>
            <p className="mt-2 font-serif leading-relaxed text-stone-300 text-legible">{body}</p>
          </Reveal>
        ))}
      </div>
    </Chapter>
  );
}

/** Shadow Guess's landing page. Links from before the game moved to /play still open it. */
export default function ShadowGuessHome() {
  const [params] = useSearchParams();
  if (params.has("mode")) return <Navigate to={`${SHADOW_GUESS_PATH}?${params}`} replace />;
  return <Landing />;
}

function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useJourney(root);
  // Models download alongside the 3D bundle (which React.lazy already started).
  useEffect(preloadLandingModels, []);
  return (
    <div ref={root} className="relative">
      {/* The 3D world sits fixed behind every chapter; the camera follows the scroll. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-paper">
        <Suspense fallback={null}>
          <World />
        </Suspense>
      </div>
      <Hero />
      <StudyChapter />
      <GuessChapter />
      <GladeChapter />
      <FinaleChapter />
    </div>
  );
}
