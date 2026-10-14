// /games/pair-pop: the landing page. A candy sky of flipping tiles, today's board, the level
// map and how to play. The board itself is on /play.
import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/store";
import { Reveal } from "../../components/Reveal";
import { formatDuration } from "../../lib/format";
import { LEVELS, PAIR_POP_PATH } from "./config";
import { dailyNumber, pairsOf } from "./deck";
import { levelUnlocked, savedDaily, savedStars } from "./guest";
import { usePairPopProgress } from "./progress";
import { EXTRUDE } from "./ui/Hud";

/** Hero tiles: [face, colour, left %, top %, size rem]. Two of each, like a real board. */
const HERO: [string, string, number, number, number][] = [
  ["🐷", "#ff8fc8", 6, 18, 5.5],
  ["🐝", "#ffd84d", 18, 62, 4.5],
  ["🦁", "#ffb340", 80, 14, 5],
  ["🐷", "#ff8fc8", 88, 58, 4.5],
  ["🍩", "#55a8ff", 70, 74, 4],
  ["🐝", "#ffd84d", 32, 8, 3.5],
  ["🦁", "#ffb340", 58, 6, 3.5],
  ["🍩", "#55a8ff", 4, 82, 3.5],
];

const STEPS = [
  { face: "👀", title: "Memorize", body: "Every board starts with a quick peek. Remember where the pals are hiding." },
  { face: "🃏", title: "Flip two", body: "Turn over two tiles. Same pal? They pop and stay. Different? Back they go." },
  { face: "🔥", title: "Chain combos", body: "Match pairs back to back for combo points. Fewer moves earn more stars." },
];

const BUTTON_3D =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-extrabold sm:px-7 sm:py-4 sm:text-lg transition-[transform,box-shadow] duration-100 hover:-translate-y-0.5 active:translate-y-[3px]";

function FlipTile({ face, color, style, delay, size = 4 }: { face: string; color: string; style?: CSSProperties; delay: number; size?: number }) {
  return (
    <div aria-hidden className="absolute [perspective:700px]" style={{ ...style, width: `calc(${size}rem * var(--s))`, animation: `pp-bob ${6 + delay}s ease-in-out ${-delay}s infinite` }}>
      <div className="relative aspect-square [transform-style:preserve-3d]" style={{ animation: `pp-flip 6s cubic-bezier(0.5,0,0.2,1.3) ${delay * 0.7}s infinite` }}>
        <div className="absolute inset-0 grid place-items-center rounded-[22%] bg-gradient-to-br from-[#7c6cff] via-[#5a8dff] to-[#38c8e8] font-display font-black text-white shadow-[0_8px_0_#3a2a9e,0_16px_30px_rgba(20,8,70,0.4)] ring-4 ring-white/40 ring-inset [backface-visibility:hidden]" style={{ fontSize: `calc(${size * 0.5}rem * var(--s))` }}>
          ?
        </div>
        <div className="absolute inset-0 grid place-items-center rounded-[22%] shadow-[0_8px_0_rgba(0,0,0,0.25),0_16px_30px_rgba(20,8,70,0.4)] ring-4 ring-white/50 ring-inset [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: color, fontSize: `calc(${size * 0.55}rem * var(--s))` }}>
          {face}
        </div>
      </div>
    </div>
  );
}

function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`tracking-tight ${className}`} aria-label={`${n} stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "text-[#ffd84d] drop-shadow-[0_2px_0_#c76a00]" : "text-white/25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function PairPopHome() {
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  const board = usePairPopProgress((s) => s.daily);
  // Re-read local storage once server progress has been merged into it.
  usePairPopProgress((s) => s.version);
  useEffect(() => {
    if (synced) void usePairPopProgress.getState().load();
  }, [synced, userId]);

  const daily = savedDaily();
  const rank = board?.mine?.rank;
  const stars = savedStars();
  const nextLevel = LEVELS.findIndex((_, i) => !(stars[i] > 0));

  return (
    <div className="overflow-x-clip pb-24">
      {/* ---------- Hero ---------- */}
      <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden py-16 [--s:0.55] sm:[--s:0.8] lg:[--s:1] bg-[radial-gradient(ellipse_90%_70%_at_50%_10%,#a48bff_0%,#6a4ae6_40%,#3a1f9e_75%,#1c0e5a_100%)]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_80%,rgba(255,143,200,0.35),transparent_40%),radial-gradient(circle_at_85%_20%,rgba(85,168,255,0.35),transparent_40%)]" />
        {HERO.map(([face, color, left, top, size], i) => (
          <FlipTile key={i} face={face} color={color} delay={i * 0.8} size={size} style={{ left: `${left}%`, top: `${top}%`, opacity: size < 4 ? 0.7 : 1 }} />
        ))}

        <div className="container-page relative text-center">
          <span className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs sm:px-4 sm:text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#7ddc6f]" />
            Daily #{dailyNumber()} is live{board?.players ? ` · ${board.players} played` : ""}
          </span>
          <h1 className="mt-5 animate-rise font-display text-6xl font-black tracking-tight text-white [animation-delay:80ms] sm:mt-6 sm:text-8xl md:text-9xl" style={{ textShadow: EXTRUDE }}>
            Pair Pop
          </h1>
          <p className="mx-auto mt-4 max-w-xl animate-rise text-base font-medium text-white/85 [animation-delay:160ms] sm:mt-5 sm:text-xl">
            A 3D memory game. Flip the tiles, find the twin pals, and pop the whole board in as few moves as you can.
          </p>

          <div className="mx-auto mt-8 flex max-w-xs animate-rise flex-col items-stretch justify-center gap-4 [animation-delay:240ms] sm:mt-9 sm:max-w-none sm:flex-row sm:items-center">
            <Link to={PAIR_POP_PATH} className={`${BUTTON_3D} bg-gradient-to-b from-[#ffe17a] to-[#ffb627] text-[#4a2600] shadow-[0_6px_0_#d07a00,0_14px_30px_rgba(208,122,0,0.45)] active:shadow-[0_2px_0_#d07a00]`}>
              {daily ? "Replay today's board" : "Play today's board"}
            </Link>
            <Link
              to={`${PAIR_POP_PATH}?level=${(nextLevel < 0 ? LEVELS.length - 1 : nextLevel) + 1}`}
              className={`${BUTTON_3D} bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md shadow-[0_6px_0_rgba(20,8,70,0.5)] active:shadow-[0_2px_0_rgba(20,8,70,0.5)]`}
            >
              {nextLevel < 0 ? "Replay level 7" : nextLevel === 0 ? "Start the levels" : `Continue · level ${nextLevel + 1}`}
            </Link>
          </div>

          <Link to="/leaderboard?game=pair-pop" className="mt-6 inline-block animate-rise text-sm font-semibold text-white/80 underline decoration-white/40 decoration-2 underline-offset-4 transition-colors [animation-delay:300ms] hover:text-white">
            🏆 See the leaderboard
          </Link>
          <br />
          {daily && (
            <div className="mx-auto mt-5 inline-flex max-w-full animate-rise flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-white/12 px-4 py-2.5 text-xs sm:px-5 sm:text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md [animation-delay:320ms]">
              <Stars n={daily.stars} className="text-lg" />
              Today: {daily.moves} moves · {formatDuration(daily.seconds)} · {daily.score} pts
              {rank ? <span className="text-[#ffe17a]">· #{rank} today</span> : null}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Levels ---------- */}
      <section className="container-page mt-16 sm:mt-20">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Seven boards, bigger every time</h2>
          <p className="mt-3 max-w-2xl text-base text-stone-400 sm:text-lg">Clear a level to open the next. Three stars means you barely made a wrong move.</p>
        </Reveal>
        <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
          {LEVELS.map((level, i) => {
            const open = levelUnlocked(i, stars);
            const got = stars[i] ?? 0;
            const card = (
              <div
                className={`relative flex aspect-[4/5] flex-col items-center justify-center rounded-2xl p-2 text-center transition-transform duration-200 sm:rounded-3xl sm:p-3 ${
                  open
                    ? "bg-gradient-to-b from-[#9a80ff] to-[#5b3fd6] shadow-[0_6px_0_#35209a,0_14px_24px_rgba(20,8,70,0.35)] hover:-translate-y-1.5 sm:shadow-[0_8px_0_#35209a,0_18px_30px_rgba(20,8,70,0.35)]"
                    : "bg-stone-900 shadow-[0_8px_0_#0b100d] ring-1 ring-white/5"
                }`}
              >
                <div className={`font-display text-4xl font-black sm:text-5xl ${open ? "text-white" : "text-stone-600"}`} style={open ? { textShadow: EXTRUDE } : undefined}>
                  {open ? i + 1 : "🔒"}
                </div>
                <div className={`mt-1.5 text-[10px] font-semibold sm:mt-2 sm:text-xs ${open ? "text-white/80" : "text-stone-600"}`}>
                  {level.cols}×{level.rows} · {pairsOf(level)} pairs
                </div>
                {open && <Stars n={got} className="mt-1 text-base sm:mt-2 sm:text-xl" />}
              </div>
            );
            return (
              <Reveal key={i} delay={i * 60}>
                {open ? (
                  <Link to={`${PAIR_POP_PATH}?level=${i + 1}`} aria-label={`Level ${i + 1}`} className="block active:translate-y-1">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------- How to play ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">How to play</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="h-full rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-7">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#9a80ff] to-[#5b3fd6] text-3xl shadow-[0_6px_0_#35209a]">{s.face}</div>
                <div className="mt-5 text-sm font-semibold text-moss-300">Step {i + 1}</div>
                <h3 className="mt-1 font-display text-2xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-stone-400">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
