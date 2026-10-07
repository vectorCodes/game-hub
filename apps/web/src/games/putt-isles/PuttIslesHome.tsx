// /games/putt-isles: the game's landing page, a twilight sky of floating islands. The course
// itself is on /play.
import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router";
import { formatToPar, generatePuttCourse, PUTT_HOLES_PER_ROUND, PUTT_ISLANDS, puttDailySeed, puttTotals } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { Reveal } from "../../components/Reveal";
import { formatCountdown, formatDuration } from "../../lib/format";
import { useNow } from "../shadow-guess/useDaily";
import { PUTT_ISLES_PATH } from "./config";
import { savedDailyResult } from "./guest";
import { BankDemo, PullDemo, SinkDemo } from "./landing/Demos";
import { HeroIsland, ISLE_PALETTES, MiniIsland, type IsleTheme } from "./landing/Islands";
import { Aurora, Birds, CloudSea, Layer, Motes, Planet, Stars, useParallax } from "./landing/Sky";
import { usePutt } from "./store";

const STEPS = [
  { demo: PullDemo, title: "Drag back, let go", body: "Pull back from anywhere like a slingshot. The further you pull, the harder the putt." },
  { demo: BankDemo, title: "Bank it", body: "The dotted line shows your first bounce. Walls are your friends." },
  { demo: SinkDemo, title: "Sink it", body: "Every hole has a par. Beat it for a birdie, or find the line for a hole in one." },
];

const ISLAND_BLURBS: Record<string, string> = {
  meadow: "Gentle bends and soft greens to warm up.",
  grove: "Hills, bumps and twin lanes.",
  dunes: "Gaps to fall through and castles to thread.",
  glacier: "Long switchbacks. Plan two shots ahead.",
  storm: "The finale. Brutal, and worth it.",
};

/** Today's daily as far as it's been played: from the server, or this browser for guests. */
function useMyDaily() {
  const daily = usePutt((s) => s.daily);
  const signedIn = useAuth((s) => !!s.user);
  const strokes = signedIn ? (daily?.myRound?.strokes ?? []) : savedDailyResult();
  const pars = daily ? generatePuttCourse(puttDailySeed(daily.date)).map((h) => h.par) : [];
  return { strokes, totals: pars.length ? puttTotals(strokes, pars) : null };
}

export default function PuttIslesHome() {
  const daily = usePutt((s) => s.daily);
  const loadDaily = usePutt((s) => s.loadDaily);
  const setMode = usePutt((s) => s.setMode);
  const synced = useAuth((s) => s.synced);
  const now = useNow();
  const { strokes, totals } = useMyDaily();
  const finished = strokes.length >= PUTT_HOLES_PER_ROUND;
  const started = strokes.length > 0 && !finished;
  const sky = useParallax<HTMLElement>();

  useEffect(() => {
    if (synced) void loadDaily();
  }, [synced, loadDaily]);

  const playLabel = finished ? "See your card" : started ? `Carry on · hole ${strokes.length + 1}` : "Play today's course";

  return (
    <div className="overflow-x-clip pb-24">
      {/* ---------- Hero: the sky world. ---------- */}
      <section
        ref={sky}
        className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-[linear-gradient(180deg,#070a1f_0%,#16163f_28%,#3a2766_52%,#8a4f86_70%,#e3907e_86%,#f6c7a4_100%)]"
      >
        <Layer depth={6}>
          <Stars />
        </Layer>
        <Layer depth={10}>
          <Aurora />
        </Layer>
        <Layer depth={14}>
          <Planet className="absolute top-[8%] left-[44%] w-36 animate-isle-bob opacity-90 [animation-duration:14s] md:w-48" />
        </Layer>
        <Layer depth={18}>
          {/* Far islands, hazy with distance. */}
          <MiniIsland theme="glacier" className="absolute top-[18%] right-[4%] w-24 animate-isle-bob opacity-45 blur-[1px] [animation-delay:-2s] md:w-32" />
          <MiniIsland theme="dunes" className="absolute top-[30%] left-[38%] w-16 animate-isle-bob opacity-35 blur-[1.5px] [animation-delay:-5s] md:w-20" />
          <MiniIsland theme="storm" className="absolute top-[10%] left-[4%] w-20 animate-isle-bob opacity-40 blur-[1px] [animation-delay:-7s] max-md:hidden" />
          <Birds />
        </Layer>
        <Layer depth={24}>
          <CloudSea tint="rgb(255 214 200 / 0.35)" duration={140} className="bottom-[16%]" reverse />
        </Layer>
        <Layer depth={34}>
          <div className="absolute top-1/2 right-[-6%] w-[min(760px,62vw)] -translate-y-[46%] max-md:top-auto max-md:right-1/2 max-md:bottom-[6%] max-md:w-[115vw] max-md:translate-x-1/2 max-md:translate-y-0 max-md:opacity-60">
            <HeroIsland className="w-full animate-isle-bob drop-shadow-[0_40px_60px_rgb(20_10_40/0.5)]" />
          </div>
        </Layer>
        <Layer depth={46}>
          <Motes />
          <CloudSea tint="rgb(255 236 228 / 0.85)" duration={80} className="-bottom-6" />
        </Layer>
        {/* Melt the sky into the page below. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-stone-950" />

        <div className="container-page relative z-10 py-16 md:py-24">
          <div className="max-w-xl text-center md:max-w-md md:text-left lg:max-w-xl max-md:mx-auto">
            <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-[0.16em] text-moss-100 uppercase ring-1 ring-white/15 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping-soft rounded-full bg-moss-300" />
                <span className="relative h-2 w-2 rounded-full bg-moss-300" />
              </span>
              {daily ? `Course #${daily.number} · next in ${formatCountdown(daily.nextAt, now)}` : "Mini-golf in the sky"}
            </p>
            <h1 className="mt-5 animate-rise font-display text-[clamp(3.25rem,2rem+6vw,7rem)] leading-[0.92] font-bold tracking-[-0.045em] text-legible [animation-delay:80ms]">
              Putt
              <br />
              <span className="bg-gradient-to-r from-moss-200 via-teal-200 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgb(140_240_210/0.35)]">Isles</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md animate-rise text-lg leading-relaxed text-stone-200 text-legible [animation-delay:160ms] md:mx-0">
              Nine holes on islands adrift above the clouds. Bank off the walls, ride the hills, and sink it in as few strokes as you can. A new course every day.
            </p>
            {finished && totals && (
              <p className="mt-6 inline-flex animate-rise items-center gap-2 rounded-full bg-moss-400/20 px-4 py-1.5 text-sm font-medium text-moss-100 ring-1 ring-moss-300/40 backdrop-blur [animation-delay:200ms]">
                Today: <span className="font-display font-semibold">{formatToPar(totals.toPar)}</span>
                <span className="text-moss-200/80">
                  · {totals.strokes} strokes · {totals.points} pts
                </span>
              </p>
            )}
            <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:240ms] sm:flex-row max-md:justify-center">
              <Link to={PUTT_ISLES_PATH} onClick={() => setMode("daily")} className="btn btn-primary h-14 px-8 text-base">
                {playLabel} <span aria-hidden>⛳</span>
              </Link>
              <Link to={PUTT_ISLES_PATH} onClick={() => setMode("practice")} className="btn h-14 bg-white/10 px-8 text-base text-stone-50 ring-1 ring-white/20 backdrop-blur hover:bg-white/15">
                Practice
              </Link>
            </div>
            <p className="mt-5 animate-rise text-sm text-stone-300 text-legible [animation-delay:300ms]">
              {daily?.players ? `${daily.players} finished today · ` : ""}Free · No sign-up needed
            </p>
          </div>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-6 z-10 flex animate-fade flex-col items-center gap-2 text-[11px] font-medium tracking-[0.2em] text-stone-300 uppercase [animation-delay:900ms] max-md:hidden">
          Drift down
          <span className="relative h-9 w-5 rounded-full ring-1 ring-stone-300/60">
            <span className="absolute top-2 left-1/2 h-2 w-1 -translate-x-1/2 animate-scroll-cue rounded-full bg-lamp-300" />
          </span>
        </div>
      </section>

      {/* ---------- The islands: a climb from meadow to storm. ---------- */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_30%,rgb(90_70_160/0.18),transparent)]" />
        <div className="container-page py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">The islands</p>
            <h2 className="mt-4 text-section">Easy to start. Hard to master.</h2>
            <p className="mt-4 text-lead">Every round hops across five islands, two holes on each and the last one alone. The higher you go, the longer and trickier they get.</p>
          </Reveal>

          <div className="relative mt-16">
            {/* The ball's route from island to island. */}
            <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[6%] top-[4%] h-[60%] w-[88%] max-lg:hidden">
              <path
                d="M2 34 C 14 34, 16 26, 26 26 S 40 20, 50 18 S 64 12, 74 10 S 90 4, 98 2"
                fill="none"
                stroke="rgb(251 227 168 / 0.5)"
                strokeWidth="2"
                strokeDasharray="2 10"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="animate-march"
              />
            </svg>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              {PUTT_ISLANDS.map((island, i) => {
                const theme = island.id as IsleTheme;
                return (
                  // Each card sits a step higher than the last, climbing to the storm.
                  <div key={island.id} className="lg:[margin-bottom:calc(var(--step)*2.75rem)]" style={{ "--step": i } as CSSProperties}>
                    <Reveal delay={i * 90} className="h-full">
                      <div
                        className="group relative h-full overflow-hidden rounded-3xl p-5 ring-1 ring-white/10 transition duration-500 hover:-translate-y-2 hover:ring-white/25"
                        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${ISLE_PALETTES[theme].glow}, rgb(255 255 255 / 0.02) 70%)` }}
                      >
                        <span className="absolute top-4 right-4 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-stone-300 uppercase ring-1 ring-white/10">
                          {i < 4 ? `Holes ${i * 2 + 1}–${i * 2 + 2}` : "Hole 9"}
                        </span>
                        <MiniIsland
                          theme={theme}
                          className="mx-auto mt-4 w-40 animate-isle-bob transition-transform duration-500 group-hover:scale-110"
                          style={{ animationDelay: `${-i * 1.7}s` }}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xl">{island.emoji}</span>
                          <h3 className="font-display text-xl font-semibold">{island.name}</h3>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{ISLAND_BLURBS[island.id]}</p>
                      </div>
                    </Reveal>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works. ---------- */}
      <section className="container-page py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-4 text-section">Aim. Putt. Sink it.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 100} className="surface overflow-hidden p-4 transition duration-300 hover:bg-white/[0.05]">
              <div className="overflow-hidden rounded-2xl bg-[#0f2a1c] p-2">
                <s.demo />
              </div>
              <div className="px-2 pt-5 pb-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-lamp-300/15 text-sm font-semibold text-lamp-200 ring-1 ring-lamp-300/30">{i + 1}</span>
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 text-stone-400">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- The clubhouse: today's leaders, at dusk. ---------- */}
      <section className="container-page py-16">
        <Reveal className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#16163f_0%,#3a2766_45%,#8a4f86_80%,#e3907e_100%)] p-6 ring-1 ring-white/10 sm:p-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <Stars />
            <CloudSea tint="rgb(255 228 216 / 0.3)" duration={110} className="-bottom-10" />
          </div>
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
            <div className="text-center md:text-left">
              <MiniIsland theme="meadow" className="mx-auto w-40 animate-isle-bob md:mx-0" />
              <h2 className="mt-4 text-section text-legible">Your name, up in the clouds.</h2>
              <p className="mt-4 text-lg text-stone-200 text-legible">Everyone plays the same nine holes today. Fewest strokes wins; time breaks ties.</p>
              <Link to={PUTT_ISLES_PATH} onClick={() => setMode("daily")} className="btn btn-primary mt-8 h-14 px-8 text-base">
                Tee off <span aria-hidden>⛳</span>
              </Link>
            </div>
            <div className="glass rounded-3xl p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-300 uppercase">Today&rsquo;s best rounds</p>
                {daily && <p className="text-xs text-stone-400 tabular-nums">next in {formatCountdown(daily.nextAt, now)}</p>}
              </div>
              {daily?.top.length ? (
                <ol className="mt-4 space-y-1.5 text-sm">
                  {daily.top.slice(0, 8).map((e) => (
                    <li key={`${e.rank}-${e.name}`} className={`flex justify-between gap-3 rounded-xl px-3 py-2 ${e.isMe ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.04]"}`}>
                      <span className="truncate">
                        <span className="mr-2 text-stone-500 tabular-nums">{e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}</span>
                        {e.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-stone-300">
                        {formatToPar(e.toPar)} · {e.points} pts <span className="text-stone-500">· {formatDuration(e.seconds)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-stone-300">Nobody&rsquo;s finished today&rsquo;s course yet. Get round first and it&rsquo;s yours.</p>
              )}
              <Link to="/leaderboard?game=putt-isles" className="mt-5 block text-center text-sm text-stone-400 hover:text-stone-200">
                This week and all-time leaderboards →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
