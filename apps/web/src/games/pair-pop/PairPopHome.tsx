// /games/pair-pop: the landing page. Gold tiles flipping on the paper, today's board, the
// level map and how to play. The board itself is on /play.
import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/store";
import { Reveal } from "../../components/Reveal";
import { formatDuration } from "../../lib/format";
import { LEVELS, PAIR_POP_PATH } from "./config";
import { dailyNumber, pairsOf } from "./deck";
import { levelUnlocked, savedDaily, savedStars } from "./guest";
import { usePairPopProgress } from "./progress";

/**
 * Hero tiles: [face, colour, left %, top %, size rem, wide only]. Two of each, like a real
 * board. The "wide only" ones sit beside the buttons, so narrow screens leave them out; the
 * rest stay in the corners, clear of the text.
 */
const HERO: [string, string, number, number, number, boolean][] = [
  ["🐷", "#c46a8a", 6, 14, 5.5, false],
  ["🐝", "#e2a940", 16, 62, 4.5, true],
  ["🦁", "#d9582c", 80, 10, 5, false],
  ["🐷", "#c46a8a", 86, 60, 4.5, true],
  ["🍩", "#2f8a73", 74, 84, 4, false],
  ["🐝", "#e2a940", 32, 5, 3.5, false],
  ["🦁", "#d9582c", 58, 4, 3.5, false],
  ["🍩", "#2f8a73", 6, 86, 3.5, false],
];

const STEPS = [
  { title: "Memorize", body: "Every board starts with a quick peek. Remember where the pals are hiding." },
  { title: "Flip two", body: "Turn over two tiles. Same pal? They pop and stay. Different? Back they go." },
  { title: "Chain combos", body: "Match pairs back to back for combo points. Fewer moves earn more stars." },
];

function FlipTile({ face, color, style, delay, size = 4, className = "" }: { face: string; color: string; style?: CSSProperties; delay: number; size?: number; className?: string }) {
  return (
    <div aria-hidden className={`absolute [perspective:700px] ${className}`} style={{ ...style, width: `calc(${size}rem * var(--s))`, animation: `pp-bob ${6 + delay}s ease-in-out ${-delay}s infinite` }}>
      <div className="relative aspect-square [transform-style:preserve-3d]" style={{ animation: `pp-flip 6s cubic-bezier(0.5,0,0.2,1.3) ${delay * 0.7}s infinite` }}>
        <div
          className="absolute inset-0 grid place-items-center rounded-sm bg-gold font-display font-light text-ink shadow-[0_7px_0_#7c5316,0_20px_36px_-12px_rgba(60,45,20,0.5)] ring-1 ring-ink/15 [backface-visibility:hidden]"
          style={{ fontSize: `calc(${size * 0.5}rem * var(--s))` }}
        >
          ?
        </div>
        <div
          className="absolute inset-0 grid place-items-center rounded-sm shadow-[0_7px_0_rgba(42,34,22,0.35),0_20px_36px_-12px_rgba(60,45,20,0.5)] ring-1 ring-ink/15 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: color, fontSize: `calc(${size * 0.55}rem * var(--s))` }}
        >
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
        <span key={i} className={i < n ? "text-lamp-400" : "text-white/20"}>
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
      <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b hairline py-20 [--s:0.55] sm:py-16 sm:[--s:0.8] lg:[--s:1]">
        {HERO.map(([face, color, left, top, size, wide], i) => (
          <FlipTile
            key={i}
            face={face}
            color={color}
            delay={i * 0.8}
            size={size}
            className={wide ? "max-lg:hidden" : ""}
            style={{ left: `${left}%`, top: `${top}%`, opacity: size < 4 ? 0.75 : 1 }}
          />
        ))}

        <div className="container-page relative z-10 text-center">
          <p className="eyebrow inline-flex animate-rise items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-500" />
            Daily #{dailyNumber()} is live{board?.players ? ` · ${board.players} played` : ""}
          </p>
          <h1 className="mt-5 animate-rise text-display [animation-delay:80ms]">
            Pair <span className="text-ember-400">Pop</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-rise text-lead [animation-delay:160ms]">
            A 3D memory game. Flip the tiles, find the twin pals, and pop the whole board in as few moves as you can.
          </p>

          <div className="mx-auto mt-9 flex max-w-xs animate-rise flex-col items-stretch justify-center gap-3 [animation-delay:240ms] sm:max-w-none sm:flex-row sm:items-center">
            <Link to={PAIR_POP_PATH} className="btn btn-primary">
              {daily ? "Replay today's board" : "Play today's board"} <span aria-hidden>→</span>
            </Link>
            <Link to={`${PAIR_POP_PATH}?level=${(nextLevel < 0 ? LEVELS.length - 1 : nextLevel) + 1}`} className="btn btn-secondary">
              {nextLevel < 0 ? "Replay level 7" : nextLevel === 0 ? "Start the levels" : `Continue · level ${nextLevel + 1}`}
            </Link>
          </div>

          <Link to="/leaderboard?game=pair-pop" className="mt-6 inline-block animate-rise label-mono text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors [animation-delay:300ms] hover:text-stone-50">
            See the leaderboard →
          </Link>
          <br />
          {daily && (
            <div className="mx-auto mt-6 inline-flex max-w-full animate-rise flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y hairline px-4 py-2.5 font-serif text-sm text-stone-300 [animation-delay:320ms]">
              <Stars n={daily.stars} className="text-lg" />
              Today: {daily.moves} moves · {formatDuration(daily.seconds)} · {daily.score} pts
              {rank ? <span className="font-semibold text-ember-400">· #{rank} today</span> : null}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Levels ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">Levels</p>
          <h2 className="mt-3 text-section">Seven boards, bigger every time</h2>
          <p className="mt-4 max-w-2xl text-lead">Clear a level to open the next. Three stars means you barely made a wrong move.</p>
        </Reveal>
        <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
          {LEVELS.map((level, i) => {
            const open = levelUnlocked(i, stars);
            const got = stars[i] ?? 0;
            const card = (
              <div
                className={`relative flex aspect-[4/5] flex-col items-center justify-center rounded-sm p-2 text-center transition-[transform,background-color] duration-300 ease-mirai sm:p-3 ${
                  open ? "surface hover:-translate-y-1 hover:bg-white/[0.07]" : "border border-dashed border-white/20 text-stone-500"
                }`}
              >
                <span className="label-mono text-stone-500">Level</span>
                <div className={`mt-1 font-display text-4xl font-light sm:text-5xl ${open ? "text-stone-50" : "text-stone-500"}`}>{open ? i + 1 : "🔒"}</div>
                <div className="mt-1.5 font-serif text-xs text-stone-400 sm:mt-2">
                  {level.cols}×{level.rows} · {pairsOf(level)} pairs
                </div>
                {open && <Stars n={got} className="mt-1 text-base sm:mt-2 sm:text-lg" />}
              </div>
            );
            return (
              <Reveal key={i} delay={i * 60}>
                {open ? (
                  <Link to={`${PAIR_POP_PATH}?level=${i + 1}`} aria-label={`Level ${i + 1}`} className="block">
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
          <p className="eyebrow">How to play</p>
          <h2 className="mt-3 text-section">Peek, flip, pop</h2>
        </Reveal>
        <div className="mt-8 grid gap-8 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="border-t hairline pt-6">
              <span className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-lamp-400 font-mono text-xs font-semibold text-lamp-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-2xl font-light uppercase">{s.title}</h3>
              <p className="mt-2 font-serif text-stone-400">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
