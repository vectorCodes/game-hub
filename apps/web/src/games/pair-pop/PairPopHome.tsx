// /games/pair-pop: the landing page, on night. A live board on the hero's screen, playing a
// demo round by itself (phones get a drawn board, its tiles flipping in a wave), today's
// board, the level map and how to play. The board itself is on /play.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/store";
import { GameHero, LastCall, lastCallButton, LivePill, MetaLink, SectionHead, StatTiles, StepCards, TodayPanel } from "../../components/landing";
import { Reveal } from "../../components/Reveal";
import { formatDuration } from "../../lib/format";
import { LEVELS, PAIR_POP_PATH } from "./config";
import { dailyNumber, pairsOf } from "./deck";
import { levelUnlocked, savedDaily, savedStars } from "./guest";
import { usePairPopProgress } from "./progress";
import { usePairPop } from "./store";

const Game = lazy(() => import("./scene/Game"));

/** How often the demo player turns a tile (ms), and how often it remembers where the twin is. */
const DEMO_PACE = 900;
const DEMO_MEMORY = 0.55;

/** One turn of the demo player: a tile at random, or, with one up, often its twin. */
function demoTurn() {
  const s = usePairPop.getState();
  // A wrong pair is still showing: let it turn back first.
  if (!s.demo || s.phase !== "play" || s.open.length >= 2) return;
  const hidden = s.tiles.map((_, i) => i).filter((i) => !s.up[i] && !s.matched[i]);
  if (!hidden.length) return;
  const any = hidden[Math.floor(Math.random() * hidden.length)];
  if (s.open.length === 1) {
    const twin = hidden.find((i) => s.tiles[i].pal === s.tiles[s.open[0]].pal);
    s.flip(twin !== undefined && Math.random() < DEMO_MEMORY ? twin : any);
  } else s.flip(any);
}

/** The real board on a demo round, playing itself while it's on screen. You can flip tiles too. */
function LiveBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(true);

  useEffect(() => {
    usePairPop.getState().startDemo();
    return () => usePairPop.getState().stopDemo();
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setOnscreen(entry.isIntersecting));
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!onscreen) return;
    const id = window.setInterval(demoTurn, DEMO_PACE);
    return () => window.clearInterval(id);
  }, [onscreen]);

  return (
    <div ref={ref} className="absolute inset-0">
      <Suspense fallback={<BoardArt />}>
        <Game preview paused={!onscreen} />
      </Suspense>
    </div>
  );
}

/** The hero board, 4 × 3: [face, colour]. Two of each, like a real board. */
const BOARD: [string, string][] = [
  ["🐷", "#e7779e"],
  ["🐝", "#e2a940"],
  ["🦁", "#d9582c"],
  ["🍩", "#2f8a73"],
  ["🦁", "#d9582c"],
  ["🐸", "#5bb198"],
  ["🐷", "#e7779e"],
  ["🐙", "#8b6cc9"],
  ["🍩", "#2f8a73"],
  ["🐙", "#8b6cc9"],
  ["🐝", "#e2a940"],
  ["🐸", "#5bb198"],
];

const STEPS = [
  { title: "Memorize", body: "Every board starts with a quick peek. Remember where the pals are hiding.", visual: <span className="text-6xl">👀</span> },
  { title: "Flip two", body: "Turn over two tiles. Same pal? They pop and stay. Different? Back they go.", visual: <span className="text-6xl">🃏</span> },
  { title: "Chain combos", body: "Match pairs back to back for combo points. Fewer moves earn more stars.", visual: <span className="text-6xl">⚡</span> },
];

/** The hero board: gold tiles turning over in a wave across the board to show their pals. */
function BoardArt() {
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center px-6 pt-14 pb-12 sm:px-10 sm:pt-16 sm:pb-14">
      <div className="grid aspect-[4/3] h-full max-w-full grid-cols-4 grid-rows-3 gap-2 sm:gap-3.5 [perspective:900px]">
        {BOARD.map(([face, color], i) => {
          const delay = ((i % 4) + Math.floor(i / 4)) * 0.35;
          return (
            <div key={i} className="relative [transform-style:preserve-3d]" style={{ animation: `pp-flip 6s cubic-bezier(0.5,0,0.2,1.3) ${delay}s infinite` }}>
              <div className="absolute inset-0 grid place-items-center rounded-lg bg-[#e2a940] font-display text-2xl font-extrabold text-[#2a2216]/70 shadow-[0_5px_0_#a8721f] [backface-visibility:hidden] sm:rounded-xl sm:text-4xl">
                ?
              </div>
              <div
                className="absolute inset-0 grid place-items-center rounded-lg text-2xl shadow-[0_5px_0_rgb(0_0_0/0.25)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-xl sm:text-4xl"
                style={{ background: color }}
              >
                {face}
              </div>
            </div>
          );
        })}
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
  const cleared = stars.filter((n) => n > 0).length;
  const cta = daily ? "Replay today's board" : "Play today's board";
  // Phones get the drawing: the live board is a whole game's worth of GPU.
  const [still] = useState(() => window.matchMedia("(max-width: 768px), (pointer: coarse), (prefers-reduced-motion: reduce)").matches);

  return (
    <div className="relative overflow-x-clip pb-24">
      <GameHero
        pill={<LivePill>Daily #{dailyNumber()} is live{board?.players ? ` · ${board.players} played` : ""}</LivePill>}
        title="Pair"
        accent="Pop"
        lead="A 3D memory game. Flip the tiles, find the twin pals, and pop the whole board in as few moves as you can."
        actions={
          <>
            <Link to={PAIR_POP_PATH} className="btn btn-primary">
              {cta} <span aria-hidden>→</span>
            </Link>
            <Link to={`${PAIR_POP_PATH}?level=${(nextLevel < 0 ? LEVELS.length - 1 : nextLevel) + 1}`} className="btn btn-secondary">
              {nextLevel < 0 ? `Replay level ${LEVELS.length}` : nextLevel === 0 ? "Start the levels" : `Continue · level ${nextLevel + 1}`}
            </Link>
          </>
        }
        meta={
          <>
            {daily && (
              <span className="inline-flex items-center gap-2">
                <Stars n={daily.stars} />
                <span>
                  Today: <span className="text-stone-100">{daily.moves} moves · {formatDuration(daily.seconds)} · {daily.score} pts</span>
                  {rank ? <span className="font-semibold text-accent-text"> · #{rank}</span> : null}
                </span>
              </span>
            )}
            <MetaLink to="/leaderboard?game=pair-pop">See the leaderboard →</MetaLink>
          </>
        }
        screen={still ? <BoardArt /> : <LiveBoard />}
        screenGround="linear-gradient(160deg, #ffd9e8, #e0d6ff 60%, #cfeee4)"
        live={still ? undefined : "Live · playing itself"}
        corner={`Daily #${dailyNumber()}`}
        caption={still ? "Find the twins" : "Go on, flip one"}
      />

      {/* ---------- Today's board ---------- */}
      <section className="container-page mt-12 sm:mt-20">
        <TodayPanel
          aside={
            <StatTiles
              stacked
              stats={[
                ["Played today", board?.players],
                ["Your moves", daily?.moves],
                ["Your score", daily?.score, " pts"],
              ]}
            />
          }
        >
          <p className="eyebrow">Daily #{dailyNumber()}</p>
          <h2 className="mt-4 text-section">One board for everyone</h2>
          <p className="mt-6 max-w-xl text-lead">
            Today&rsquo;s board is the same for every player: the same pals, in the same places. Sign in and your finish goes on the leaderboard.
          </p>
          <Link to={PAIR_POP_PATH} className="btn btn-primary mt-8">
            {cta} <span aria-hidden>→</span>
          </Link>
        </TodayPanel>
      </section>

      {/* ---------- Levels ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow={`Levels · ${cleared} of ${LEVELS.length} cleared`} title={`${LEVELS.length} boards, bigger every time`}>
          Clear a level to open the next. Three stars means you barely made a wrong move.
        </SectionHead>
        <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
          {LEVELS.map((level, i) => {
            const open = levelUnlocked(i, stars);
            const got = stars[i] ?? 0;
            const next = i === nextLevel;
            const card = (
              <div
                className={`relative flex aspect-[4/5] flex-col items-center justify-center rounded-(--radius-ui) p-2 text-center transition-[transform,box-shadow] duration-300 ease-mirai sm:p-3 ${
                  open ? `surface hover:-translate-y-1 hover:shadow-glow ${next ? "shadow-glow ring-2 ring-accent" : ""}` : "border border-dashed border-white/15 text-stone-500"
                }`}
              >
                <span className="label-mono text-stone-500">Level</span>
                <div className={`mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl ${open ? "text-stone-50" : "text-stone-500"}`}>{open ? i + 1 : "🔒"}</div>
                <div className="mt-1.5 text-xs text-stone-400 sm:mt-2">
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
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow="How to play" title="Peek, flip, pop" />
        <StepCards steps={STEPS} />
      </section>

      <LastCall
        title="Pop the whole board."
        action={
          <Link to={PAIR_POP_PATH} className={lastCallButton}>
            {cta} <span aria-hidden>→</span>
          </Link>
        }
      >
        Daily #{dailyNumber()} is live: the same tiles for everyone, all day.
      </LastCall>
    </div>
  );
}
