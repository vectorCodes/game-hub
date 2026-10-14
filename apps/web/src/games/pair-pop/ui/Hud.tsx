// What's laid over the board: the top bar (moves, time, pairs), the "Memorize!" peek
// banner, combo pops, and the results card.
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { formatDuration } from "../../../lib/format";
import { useSound } from "../../../lib/sound";
import { LEVELS, PAIR_POP_HOME, PAIR_POP_PATH } from "../config";
import { dailyNumber, pairsOf } from "../deck";
import { levelUnlocked } from "../guest";
import { useAuth } from "../../../auth/store";
import { elapsedSeconds, pairPopTitle, usePairPop, type PairPopResult } from "../store";

/** Stacked text shadows: letters with depth, like they're cut from candy. */
export const EXTRUDE = "0 1px 0 #c9b8ff, 0 2px 0 #b29dff, 0 3px 0 #9a82f5, 0 4px 0 #8466e8, 0 5px 0 #6d4fd6, 0 10px 18px rgba(30,10,90,0.45)";

const TONES = {
  sun: "bg-gradient-to-b from-[#ffe17a] to-[#ffb627] text-[#4a2600] shadow-[0_5px_0_#d07a00,0_10px_20px_rgba(208,122,0,0.35)] active:shadow-[0_2px_0_#d07a00]",
  grape: "bg-gradient-to-b from-[#a48bff] to-[#7a5cff] text-white shadow-[0_5px_0_#4f32c9,0_10px_20px_rgba(79,50,201,0.35)] active:shadow-[0_2px_0_#4f32c9]",
  glass: "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md shadow-[0_4px_0_rgba(20,8,70,0.45)] active:shadow-[0_1px_0_rgba(20,8,70,0.45)] hover:bg-white/25",
};

/** A chunky button that presses down. */
export function CandyButton({ tone = "sun", className = "", children, ...rest }: { tone?: keyof typeof TONES } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-display font-bold tracking-tight transition-[transform,box-shadow,background-color] duration-100 select-none hover:-translate-y-0.5 active:translate-y-[3px] disabled:pointer-events-none disabled:opacity-50 ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Pill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex max-w-[6.5rem] min-w-0 flex-1 basis-0 flex-col items-center rounded-xl bg-white/12 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_0_rgba(20,8,70,0.35)] ring-1 ring-white/20 backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-1.5 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_0_rgba(20,8,70,0.35)]">
      <span className="text-[9px] font-semibold tracking-[0.1em] text-white/70 uppercase sm:text-[10px] sm:tracking-[0.14em]">{label}</span>
      <span className="font-display text-base leading-tight font-bold text-white tabular-nums sm:text-xl">{children}</span>
    </div>
  );
}

const ICON_BUTTON = `grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base transition-transform active:translate-y-[3px] sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg ${TONES.glass}`;

function Clock() {
  const startedAt = usePairPop((s) => s.startedAt);
  const endedAt = usePairPop((s) => s.endedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt || endedAt) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [startedAt, endedAt]);
  const s = Math.floor(elapsedSeconds({ startedAt, endedAt }));
  return <>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</>;
}

/**
 * One row that fits a 320 px phone: back, the three stats, sound and restart; then the pairs
 * bar. Its height goes to the store so the camera keeps the board below it. It fades out
 * during the peek, when the "Memorize!" banner takes its place.
 */
function TopBar() {
  const mode = usePairPop((s) => s.mode);
  const moves = usePairPop((s) => s.moves);
  const matches = usePairPop((s) => s.matches);
  const pairs = usePairPop((s) => pairsOf(s.level));
  const score = usePairPop((s) => s.score);
  const start = usePairPop((s) => s.start);
  const peeking = usePairPop((s) => s.phase === "peek");
  const muted = useSound((s) => s.muted);
  const toggleSound = useSound((s) => s.toggle);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => usePairPop.setState({ hudTop: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={bar}
      className={`pointer-events-none absolute inset-x-0 top-0 px-2.5 pt-2.5 pb-1 transition-opacity duration-300 sm:px-5 sm:pt-4 ${peeking ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex items-center gap-1.5 sm:gap-3">
        <Link to={PAIR_POP_HOME} aria-label="Back" className={`pointer-events-auto ${ICON_BUTTON}`}>
          ←
        </Link>
        <span className="hidden shrink-0 font-display text-xl font-extrabold text-white md:inline" style={{ textShadow: EXTRUDE }}>
          {pairPopTitle(mode)}
        </span>

        <div className="flex min-w-0 flex-1 justify-center gap-1.5 sm:gap-2.5">
          <Pill label="Moves">{moves}</Pill>
          <Pill label="Time">
            <Clock />
          </Pill>
          <Pill label="Score">{score}</Pill>
        </div>

        <button type="button" aria-label={muted ? "Sound on" : "Sound off"} onClick={toggleSound} className={`pointer-events-auto ${ICON_BUTTON}`}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button type="button" aria-label="New board" onClick={start} className={`pointer-events-auto ${ICON_BUTTON}`}>
          ↻
        </button>
      </div>

      {/* Pairs found, as a candy progress bar. */}
      <div className="mx-auto mt-2 flex max-w-md items-center gap-2.5 px-1 sm:mt-3">
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#1d0f55]/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] ring-1 ring-white/20 sm:h-3.5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#ffd84d] via-[#ff9a5c] to-[#ff6fae] shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] transition-[width] duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)]"
            style={{ width: `${(matches / pairs) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold text-white/80 tabular-nums">
          {matches}/{pairs}
        </span>
      </div>
    </div>
  );
}

/** "Memorize!" with a draining bar while every tile is up (over the top bar, clear of the tiles), then a quick "Go!". */
function PeekBanner() {
  const phase = usePairPop((s) => s.phase);
  const peek = usePairPop((s) => s.level.peek);
  const round = usePairPop((s) => s.round);
  const [go, setGo] = useState(false);

  useEffect(() => {
    if (phase !== "play" || usePairPop.getState().moves > 0) return;
    setGo(true);
    const t = setTimeout(() => setGo(false), 800);
    return () => clearTimeout(t);
  }, [phase, round]);

  if (phase === "peek")
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2.5 flex justify-center sm:top-4">
        <div key={round} className="animate-pop rounded-2xl bg-white/15 px-5 py-2 text-center shadow-[0_5px_0_rgba(20,8,70,0.4)] ring-1 ring-white/25 backdrop-blur-md sm:rounded-3xl sm:px-7 sm:py-3">
          <div className="font-display text-2xl font-extrabold text-white sm:text-3xl" style={{ textShadow: EXTRUDE }}>
            Memorize!
          </div>
          <div className="mx-auto mt-1.5 h-2 w-32 overflow-hidden rounded-full bg-black/25 sm:mt-2 sm:w-40">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-[#ffd84d] to-[#ff9a5c]" style={{ animation: `pp-drain ${peek}s linear both` }} />
          </div>
        </div>
      </div>
    );
  if (go)
    return (
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="animate-pop font-display text-6xl font-black text-[#ffe17a] sm:text-8xl" style={{ textShadow: "0 2px 0 #ffb627, 0 4px 0 #f59e0b, 0 6px 0 #d97706, 0 8px 0 #b45309, 0 16px 30px rgba(60,20,0,0.45)" }}>
          Go!
        </div>
      </div>
    );
  return null;
}

function ComboPop() {
  const pop = usePairPop((s) => s.comboPop);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!pop) return;
    setShown(pop.id);
    const t = setTimeout(() => setShown(null), 1100);
    return () => clearTimeout(t);
  }, [pop]);
  if (!pop || shown !== pop.id) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center px-4">
      <div key={pop.id} className="animate-pop text-center" style={{ rotate: pop.id % 2 ? "-4deg" : "4deg" }}>
        <div className="font-display text-4xl font-black text-white sm:text-6xl" style={{ textShadow: EXTRUDE }}>
          Combo ×{pop.combo}
        </div>
        <div className="mt-1 font-display text-xl font-extrabold text-[#ffe17a] sm:text-2xl" style={{ textShadow: "0 3px 0 #c76a00, 0 8px 14px rgba(0,0,0,0.3)" }}>
          +{pop.points}
        </div>
      </div>
    </div>
  );
}

function Star({ on, delay, big }: { on: boolean; delay: number; big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${big ? "h-16 w-16 -translate-y-2.5 sm:h-20 sm:w-20 sm:-translate-y-3" : "h-11 w-11 sm:h-14 sm:w-14"} animate-pop drop-shadow-[0_6px_0_rgba(20,8,70,0.35)]`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`star-${on}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={on ? "#fff1a1" : "#8d7fc9"} />
          <stop offset="1" stopColor={on ? "#ffb627" : "#5a4a9e"} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
        fill={`url(#star-${on})`}
        stroke={on ? "#e08a00" : "#3d2f80"}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Where the score went: saving, saved (with today's rank), or only kept in this browser. */
function SaveLine({ result, daily, signedIn, canSignIn, onSignIn }: { result: PairPopResult; daily: boolean; signedIn: boolean; canSignIn: boolean; onSignIn: () => Promise<void> }) {
  const board = (
    <Link to="/leaderboard?game=pair-pop" className="font-bold text-[#5b3fd6] underline decoration-2 underline-offset-2 hover:text-[#3b2290]">
      Leaderboard
    </Link>
  );
  let line: ReactNode;
  if (result.saved === "saving") line = <span className="animate-pulse">Saving your score…</span>;
  else if (result.saved === "local") line = <>Couldn't reach the server: saved on this device.</>;
  else if (daily && result.replay) line = <>Saved. Only your first finish today counts · {board}</>;
  else if (daily && result.rank) line = <>🏆 You're <b className="text-[#3b2290]">#{result.rank}</b> of {result.players} today · {board}</>;
  else if (daily && !signedIn)
    line = canSignIn ? (
      <>
        Saved.{" "}
        <button type="button" onClick={() => void onSignIn()} className="font-bold text-[#5b3fd6] underline decoration-2 underline-offset-2 hover:text-[#3b2290]">
          Sign in
        </button>{" "}
        to get on the {board}
      </>
    ) : (
      <>Saved · {board}</>
    );
  else line = <>✓ Score saved{daily ? <> · {board}</> : null}</>;
  return <p className="mt-3 text-xs font-medium text-[#6c5aa8] sm:text-sm">{line}</p>;
}

function Results() {
  const result = usePairPop((s) => s.result);
  const mode = usePairPop((s) => s.mode);
  const pairs = usePairPop((s) => pairsOf(s.level));
  const start = usePairPop((s) => s.start);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const signedIn = useAuth((s) => !!s.user);
  const authEnabled = useAuth((s) => s.enabled);
  const signIn = useAuth((s) => s.signIn);
  if (!result) return null;

  const next = mode.kind === "level" && mode.level + 1 < LEVELS.length ? mode.level + 1 : null;
  const headline = result.stars === 3 ? "Perfect memory!" : result.stars === 2 ? "Great job!" : "Board cleared!";

  const share = async () => {
    const text = `Pair Pop Daily #${dailyNumber()} ${"⭐".repeat(result.stars)}\n${result.moves} moves · ${formatDuration(result.seconds)} · ${result.score} pts`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };

  return (
    // Scrolls when it can't fit (a phone on its side); centred otherwise.
    <div className="absolute inset-0 animate-fade overflow-y-auto overscroll-contain bg-[#12073a]/55 backdrop-blur-[3px]">
      <div className="flex min-h-full items-center justify-center px-3 pt-14 pb-6 [perspective:900px] sm:px-4">
        <div className="pp-card-in relative w-full max-w-[26rem] rounded-[1.75rem] sm:rounded-[2rem] bg-gradient-to-b from-[#8f74ff] to-[#5b3fd6] p-1.5 shadow-[0_14px_0_#35209a,0_30px_60px_rgba(10,0,50,0.55)]">
          <div className="rounded-[1.4rem] bg-gradient-to-b from-[#fdfbff] to-[#efe8ff] px-4 pt-4 pb-5 text-center sm:rounded-[1.65rem] sm:px-6 sm:pt-5 sm:pb-6">
            <div className="-mt-11 flex sm:-mt-14 items-end justify-center gap-1">
              <Star on={result.stars >= 1} delay={0.25} />
              <Star on={result.stars >= 2} delay={0.45} big />
              <Star on={result.stars >= 3} delay={0.65} />
            </div>
            <h2 className="mt-1 font-display text-2xl font-black text-[#3b2290] sm:text-3xl">{headline}</h2>
            <p className="mt-0.5 text-sm font-medium text-[#6c5aa8]">
              {pairPopTitle(mode)} · {pairs} pairs
            </p>

            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
              {[
                ["Moves", result.moves],
                ["Time", formatDuration(result.seconds)],
                ["Combo", `×${result.bestCombo}`],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl bg-white px-1.5 py-2 shadow-[0_4px_0_#ddd2ff] ring-1 ring-[#e6deff] sm:rounded-2xl sm:px-2 sm:py-2.5">
                  <div className="text-[9px] font-bold tracking-[0.1em] text-[#8d7fc9] uppercase sm:text-[10px] sm:tracking-[0.12em]">{label}</div>
                  <div className="truncate font-display text-lg font-extrabold text-[#3b2290] sm:text-xl">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#ffe17a] to-[#ffb627] py-2.5 shadow-[0_4px_0_#d07a00]">
              <div className="text-[10px] font-bold tracking-[0.14em] text-[#7a4300] uppercase">Score</div>
              <div className="font-display text-2xl font-black text-[#4a2600] sm:text-3xl">{result.score}</div>
            </div>
            <SaveLine result={result} daily={mode.kind === "daily"} signedIn={signedIn} canSignIn={authEnabled} onSignIn={signIn} />

            <div className="mt-5 flex flex-col gap-3 sm:mt-6">
              {next !== null && levelUnlocked(next) ? (
                <CandyButton
                  className="w-full text-lg"
                  onClick={() => navigate(`${PAIR_POP_PATH}?level=${next + 1}`)}
                >
                  Next level →
                </CandyButton>
              ) : mode.kind === "daily" ? (
                <CandyButton className="w-full text-lg" onClick={share}>
                  {copied ? "Copied!" : "Share result"}
                </CandyButton>
              ) : null}
              <div className="flex gap-3">
                <CandyButton tone="grape" className="flex-1 px-3" onClick={start}>
                  Play again
                </CandyButton>
                <CandyButton tone="grape" className="flex-1 px-3" onClick={() => navigate(PAIR_POP_HOME)}>
                  Levels
                </CandyButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hud() {
  const phase = usePairPop((s) => s.phase);
  return (
    <>
      <TopBar />
      <PeekBanner />
      <ComboPop />
      {phase === "won" && <Results />}
    </>
  );
}
