// What's laid over the board: the top bar (moves, time, pairs), the "Memorize!" peek
// banner, combo pops, and the results card.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { formatDuration } from "../../../lib/format";
import { useSound } from "../../../lib/sound";
import { LEVELS, PAIR_POP_HOME, PAIR_POP_PATH } from "../config";
import { dailyNumber, pairsOf } from "../deck";
import { levelUnlocked } from "../guest";
import { useAuth } from "../../../auth/store";
import { elapsedSeconds, pairPopTitle, usePairPop, type PairPopResult } from "../store";

/** HUD controls: square glass buttons with a hairline, as on every GameHub game screen. */
const ICON_BUTTON =
  "glass grid h-10 w-10 shrink-0 place-items-center text-base text-stone-100 transition-[transform,background-color] duration-200 ease-mirai hover:-translate-y-0.5 hover:bg-stone-800/80 sm:h-11 sm:w-11 sm:text-lg";

function Pill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="glass flex max-w-[6.5rem] min-w-0 flex-1 basis-0 flex-col items-center px-1.5 py-1 sm:px-3 sm:py-1.5">
      <span className="label-mono text-[9px] text-stone-400 sm:text-[10px]">{label}</span>
      <span className="font-display text-base leading-tight font-medium text-stone-50 tabular-nums sm:text-xl">{children}</span>
    </div>
  );
}

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
        <span className="hidden shrink-0 font-display text-xl font-light text-stone-50 uppercase md:inline">
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

      {/* Pairs found: a hairline track filling with gold. */}
      <div className="mx-auto mt-2.5 flex max-w-md items-center gap-2.5 px-1 sm:mt-3">
        <div className="relative h-1.5 flex-1 overflow-hidden bg-white/12 sm:h-2">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-lamp-500 to-ember-500 transition-[width] duration-500 ease-mirai"
            style={{ width: `${(matches / pairs) * 100}%` }}
          />
        </div>
        <span className="shrink-0 label-mono text-stone-300 tabular-nums">
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
        <div key={round} className="glass animate-pop px-5 py-2.5 text-center sm:px-7 sm:py-3">
          <div className="label-mono text-lamp-300">Peek</div>
          <div className="font-display text-2xl font-light text-stone-50 uppercase sm:text-3xl">Memorize</div>
          <div className="mx-auto mt-2 h-1 w-32 overflow-hidden bg-white/12 sm:w-40">
            <div className="h-full origin-left bg-lamp-400" style={{ animation: `pp-drain ${peek}s linear both` }} />
          </div>
        </div>
      </div>
    );
  if (go)
    return (
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="animate-pop font-display text-7xl font-light text-lamp-300 uppercase text-legible sm:text-9xl">Go</div>
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
        <div className="font-display text-4xl font-light text-stone-50 uppercase text-legible sm:text-6xl">Combo ×{pop.combo}</div>
        <div className="mt-1 font-mono text-lg font-semibold text-lamp-300 text-legible sm:text-xl">+{pop.points}</div>
      </div>
    </div>
  );
}

function Star({ on, delay, big }: { on: boolean; delay: number; big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${big ? "h-14 w-14 -translate-y-2 sm:h-16 sm:w-16" : "h-10 w-10 sm:h-12 sm:w-12"} animate-pop`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden
    >
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
        fill={on ? "#cc922f" : "none"}
        stroke={on ? "#8a5a16" : "#c8b48f"}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Where the score went: saving, saved (with today's rank), or only kept in this browser. */
function SaveLine({ result, daily, signedIn, canSignIn, onSignIn }: { result: PairPopResult; daily: boolean; signedIn: boolean; canSignIn: boolean; onSignIn: () => Promise<void> }) {
  const board = (
    <Link to="/leaderboard?game=pair-pop" className="font-semibold text-ember-400 underline underline-offset-2 hover:text-ember-300">
      Leaderboard
    </Link>
  );
  let line: ReactNode;
  if (result.saved === "saving") line = <span className="animate-pulse">Saving your score…</span>;
  else if (result.saved === "local") line = <>Couldn't reach the server: saved on this device.</>;
  else if (daily && result.replay) line = <>Saved. Only your first finish today counts · {board}</>;
  else if (daily && result.rank) line = <>You're <b className="text-stone-50">#{result.rank}</b> of {result.players} today · {board}</>;
  else if (daily && !signedIn)
    line = canSignIn ? (
      <>
        Saved.{" "}
        <button type="button" onClick={() => void onSignIn()} className="font-semibold text-ember-400 underline underline-offset-2 hover:text-ember-300">
          Sign in
        </button>{" "}
        to get on the {board}
      </>
    ) : (
      <>Saved · {board}</>
    );
  else line = <>✓ Score saved{daily ? <> · {board}</> : null}</>;
  return <p className="mt-4 font-serif text-sm text-stone-400">{line}</p>;
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
    <div className="absolute inset-0 animate-fade overflow-y-auto overscroll-contain bg-stone-950/60 backdrop-blur-[3px]">
      <div className="flex min-h-full items-center justify-center px-3 pt-10 pb-6 [perspective:900px] sm:px-4">
        <div className="theme-paper paper-ground pp-card-in relative w-full max-w-[26rem] rounded-sm px-5 pt-6 pb-6 text-center text-stone-100 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.75)] sm:px-7 sm:pt-7">
          <div>
            <div className="flex items-end justify-center gap-1">
              <Star on={result.stars >= 1} delay={0.25} />
              <Star on={result.stars >= 2} delay={0.45} big />
              <Star on={result.stars >= 3} delay={0.65} />
            </div>
            <h2 className="mt-3 font-display text-3xl font-light uppercase sm:text-4xl">{headline}</h2>
            <p className="mt-1 label-mono text-stone-500">
              {pairPopTitle(mode)} · {pairs} pairs
            </p>

            <div className="mt-5 grid grid-cols-3 border-y hairline">
              {[
                ["Moves", result.moves],
                ["Time", formatDuration(result.seconds)],
                ["Combo", `×${result.bestCombo}`],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 px-1.5 py-3 not-first:border-l not-first:hairline">
                  <div className="label-mono text-stone-500">{label}</div>
                  <div className="mt-1 truncate font-serif text-xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="label-mono text-stone-500">Score</div>
              <div className="font-display text-5xl font-light text-ember-500">{result.score}</div>
            </div>
            <SaveLine result={result} daily={mode.kind === "daily"} signedIn={signedIn} canSignIn={authEnabled} onSignIn={signIn} />

            <div className="mt-6 flex flex-col gap-2.5">
              {next !== null && levelUnlocked(next) ? (
                <button type="button" className="btn btn-primary w-full" onClick={() => navigate(`${PAIR_POP_PATH}?level=${next + 1}`)}>
                  Next level <span aria-hidden>→</span>
                </button>
              ) : mode.kind === "daily" ? (
                <button type="button" className="btn btn-primary w-full" onClick={share}>
                  {copied ? "Copied!" : "Share result"}
                </button>
              ) : null}
              <div className="flex gap-2.5">
                <button type="button" className="btn btn-secondary flex-1 px-3" onClick={() => void start()}>
                  Play again
                </button>
                <button type="button" className="btn btn-secondary flex-1 px-3" onClick={() => navigate(PAIR_POP_HOME)}>
                  Levels
                </button>
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
