import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { HINT_PENALTY, SKIPPED, type GameMode, type LightAngle, type SessionView } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { Segmented } from "../../components/Segmented";
import { play, useSound } from "../../lib/sound";
import { useShadowGame } from "./store";
import { ShadowScene } from "./scene/ShadowScene";
import { REVEAL_ANGLE } from "./scene/angles";
import { ShadowHistory } from "./ui/ShadowHistory";
import { GuessInput } from "./ui/GuessInput";
import { ResultPanel } from "./ui/ResultPanel";
import { useRunBest } from "./useRunBest";

const ERROR_MESSAGES: Record<string, string> = {
  api_unreachable: "Can't reach the game server. Is the API running? Start everything with `pnpm dev` from the repo root.",
  network_error: "You seem to be offline.",
  model_failed: "This shadow didn't load.",
};

const MODES: { value: GameMode; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "free", label: "Free play" },
];

function StageChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-stone-950/75 px-3 py-1 text-xs font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur-md">
      {children}
    </span>
  );
}

const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const turn = (i / 22) * Math.PI * 2;
  const reach = i % 2 ? 34 : 24; // % of the stage, alternating for a ragged burst
  return {
    "--dx": `${Math.cos(turn) * reach}cqw`,
    "--dy": `${Math.sin(turn) * reach}cqh`,
    animationDelay: `${(i % 3) * 60}ms`,
    size: i % 3 ? 6 : 10,
  };
});

/** A burst of light from the object when the player wins. */
function Sparks() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 [container-type:size]">
      {SPARKS.map(({ size, ...style }, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 animate-spark rounded-full bg-lamp-300 shadow-[0_0_12px_3px_rgba(248,207,114,0.8)]"
          style={{ ...style, width: size, height: size } as CSSProperties}
        />
      ))}
    </div>
  );
}

function MuteButton() {
  const { muted, toggle } = useSound();
  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Turn sound on" : "Mute sound"}
      aria-pressed={!muted}
      className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-stone-950/75 text-stone-100 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-stone-900"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
        {muted ? <path d="m22 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
      </svg>
    </button>
  );
}

/** Plays the sound for what just changed in the round: the light turning, a hint, the end. */
function useRoundSounds(session: SessionView | null) {
  const prev = useRef(session);
  useEffect(() => {
    const before = prev.current;
    prev.current = session;
    // Only changes within one round: loading or switching rounds is silent.
    if (!session || !before || before.sessionId !== session.sessionId) return;
    if (session.status !== before.status) play(session.status === "won" ? "win" : "lose");
    else if (session.step > before.step) play("turn");
    if (session.hintUsed && !before.hintUsed) play("hint");
  }, [session]);
}

/** Free play: shadows solved in a row, the run's score, and the best run to beat. */
function RunBar({ solved, score, best }: { solved: number; score: number; best: number }) {
  const cell = "flex-1 text-center";
  const label = "text-[11px] font-medium tracking-wide text-stone-400 uppercase";
  return (
    <div className="flex items-center divide-x divide-white/10 rounded-2xl bg-lamp-400/[0.06] py-2 ring-1 ring-lamp-400/20">
      <div className={cell}>
        <div key={solved} className="animate-pop font-display text-xl font-bold tabular-nums">
          {solved}
          {solved > 0 && "🔥"}
        </div>
        <div className={label}>In a row</div>
      </div>
      <div className={cell}>
        <div key={score} className="animate-pop font-display text-xl font-bold tabular-nums">{score}</div>
        <div className={label}>Run score</div>
      </div>
      <div className={cell}>
        <div className={`font-display text-xl font-bold tabular-nums ${solved > best && best > 0 ? "text-lamp-300" : ""}`}>
          {Math.max(best, solved)}
        </div>
        <div className={label}>{solved > best && best > 0 ? "New best" : "Best"}</div>
      </div>
    </div>
  );
}

/** Worth-so-far and the category hint. */
function ScoreBar({ session, onHint }: { session: SessionView; onHint: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/10 sm:px-4 sm:py-3">
      <div>
        <div className="text-[11px] font-medium tracking-wide text-stone-400 uppercase">Worth</div>
        <div key={session.potentialScore} className="animate-pop font-display text-2xl leading-none font-bold text-moss-300 sm:text-3xl text-glow tabular-nums">
          {session.potentialScore}
        </div>
      </div>
      {session.hintUsed ? (
        <div className="animate-pop text-right">
          <div className="text-[11px] font-medium tracking-wide text-stone-400 uppercase">Category</div>
          <div className="font-medium text-white">{session.category}</div>
        </div>
      ) : (
        <button
          onClick={onHint}
          className="rounded-full bg-white/5 px-3.5 py-1.5 text-sm text-stone-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          💡 Category <span className="text-stone-500">−{HINT_PENALTY}</span>
        </button>
      )}
    </div>
  );
}

export default function ShadowGuessPage() {
  const { mode, session, loading, error, names, open, next, submitGuess, skip, useHint, loadNames } =
    useShadowGame();

  // Per-session view state: thumbnails, which past angle is shown, whether the model loaded.
  const sessionId = session?.sessionId;
  const [thumbs, setThumbs] = useState<{ sessionId?: string; urls: (string | undefined)[] }>({ urls: [] });
  const [viewing, setViewing] = useState<number | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [modelFailed, setModelFailed] = useState<string | null>(null);

  // Load once sign-in state is known (and guest games are claimed); reload when the
  // player signs in or out, since sessions belong to the account.
  const authKey = useAuth((s) => (s.synced ? (s.user?.id ?? "guest") : null));
  const { me, refreshMe } = useAuth();
  const loadedFor = useRef<string | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    void loadNames();
    if (!authKey || loadedFor.current === authKey) return;
    const first = loadedFor.current === null;
    loadedFor.current = authKey;
    // The hub links here with ?mode=free; consume it so switching tabs later isn't overridden.
    const requested = params.get("mode");
    if (first && (requested === "free" || requested === "daily")) {
      setParams({}, { replace: true });
      void open(requested);
    } else if (!first || !useShadowGame.getState().session) {
      void open(useShadowGame.getState().mode);
    }
  }, [authKey, open, loadNames, params, setParams]);

  // A new angle (or session) always jumps the view back to the current shadow.
  useEffect(() => setViewing(null), [sessionId, session?.step]);

  const onSnapshot = useCallback(
    (index: number, url: string) =>
      setThumbs((t) => {
        const urls = t.sessionId === sessionId ? [...t.urls] : [];
        urls[index] = url;
        return { sessionId, urls };
      }),
    [sessionId],
  );
  const onReady = useCallback(() => setReady(sessionId ?? null), [sessionId]);
  const onModelError = useCallback(() => setModelFailed(sessionId ?? null), [sessionId]);

  const playing = session?.status === "playing";
  useRoundSounds(session);
  const runBest = useRunBest(session?.run ?? null);

  // Pull fresh stats (streak, totals) when a round ends.
  const finished = session && !playing ? session.sessionId : null;
  useEffect(() => {
    if (finished) void refreshMe();
  }, [finished, refreshMe]);

  const thumbnails = thumbs.sessionId === sessionId ? thumbs.urls : [];
  const shownError = error ?? (session && modelFailed === sessionId ? "model_failed" : null);
  const casting = loading || (session && ready !== sessionId && !shownError);

  let angle = REVEAL_ANGLE;
  if (session && playing) angle = viewing !== null ? session.angles[viewing] : session.angle;

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-7xl grid-rows-[minmax(min(20rem,45dvh),1fr)_auto] gap-3 p-3 sm:gap-4 sm:p-4 md:h-[calc(100dvh-3.5rem)] md:grid-cols-[minmax(0,1fr)_19rem] md:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_23rem] lg:p-5">
      {/* Stage: the lit wall and the shadow. */}
      <section className="relative min-h-0 overflow-hidden rounded-2xl bg-wall sm:rounded-3xl ring-1 ring-lamp-300/20 shadow-[0_0_90px_-30px_rgba(244,185,78,0.45)]">
        {session && (
          <ShadowScene
            sessionKey={session.sessionId}
            modelUrl={session.modelUrl}
            angle={angle}
            revealed={!playing}
            orbit={!playing}
            snapshotAngles={session.angles}
            onSnapshot={onSnapshot}
            onReady={onReady}
            onError={onModelError}
          />
        )}

        {/* Spotlight falloff at the edges of the wall. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_70%_at_50%_45%,transparent_55%,rgba(22,32,27,0.32))]"
        />
        {/* A band of light crosses the wall each time the angle changes. */}
        {session && playing && ready === sessionId && (
          <div
            key={`${sessionId}-${session.step}`}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -inset-x-1/2 animate-sweep bg-gradient-to-r from-transparent via-white/45 to-transparent"
          />
        )}
        {session?.status === "won" && (
          <div key={`won-${sessionId}`}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-glow bg-[radial-gradient(circle_at_50%_50%,rgba(233,160,58,0.5),rgba(244,185,78,0.25)_40%,transparent_65%)]"
            />
            <Sparks />
          </div>
        )}

        {session && (
          <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
            <StageChip>
              {session.puzzleNumber
                ? `Daily #${session.puzzleNumber}${session.theme ? ` · ${session.theme.emoji} ${session.theme.name}` : ""}`
                : session.run
                  ? `Run · shadow ${session.run.solved + (session.status === "won" ? 0 : 1)}`
                  : "Free play"}
            </StageChip>
            <StageChip>
              {playing
                ? viewing !== null
                  ? `Viewing angle ${viewing + 1}`
                  : `Angle ${session.step + 1} of ${session.maxSteps}`
                : "Drag to rotate"}
            </StageChip>
          </div>
        )}

        {session && (
          <div className="absolute right-2.5 bottom-2.5 sm:right-4 sm:bottom-4">
            <MuteButton />
          </div>
        )}

        {(casting || shownError) && (
          <div className="absolute inset-0 grid animate-fade place-items-center bg-stone-950/60 p-6 text-center backdrop-blur-sm">
            {shownError ? (
              <div className="max-w-sm space-y-3 text-sm text-stone-300">
                <p>{ERROR_MESSAGES[shownError] ?? `Something went wrong (${shownError}).`}</p>
                <button
                  onClick={() => void open(mode)}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-sm text-stone-300">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-lamp-400" />
                Casting a shadow…
              </div>
            )}
          </div>
        )}
      </section>

      {/* Control panel. */}
      <aside className="flex min-h-0 flex-col gap-3 md:overflow-y-auto md:pr-1 lg:gap-4">
        <div className="hidden animate-rise lg:block">
          <h1 className="font-display text-3xl font-bold tracking-tight">Shadow Guess</h1>
          <p className="mt-1 text-sm text-stone-400">Name the object from its shadow. Every miss turns the light.</p>
        </div>

        <Segmented options={MODES} value={mode} onChange={(m) => void open(m)} label="Game mode" className="w-full" />

        {session && playing && (
          <>
            {session.run && <RunBar solved={session.run.solved} score={session.run.score} best={runBest} />}
            <ScoreBar session={session} onHint={() => void useHint()} />
            <ShadowHistory
              step={session.step}
              maxSteps={session.maxSteps}
              thumbnails={thumbnails}
              viewing={viewing}
              onView={setViewing}
            />
            {session.wrongGuesses.length > 0 && (
              <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
                {session.wrongGuesses.map((g, i) => (
                  <li
                    key={i}
                    className={`shrink-0 animate-pop rounded-full px-3 py-1 text-sm ring-1 ${
                      g === SKIPPED
                        ? "bg-white/5 text-stone-400 ring-white/10"
                        : "bg-ember-500/10 text-ember-300 line-through decoration-ember-400/60 ring-ember-500/20"
                    }`}
                  >
                    {g === SKIPPED ? "skipped" : g}
                  </li>
                ))}
              </ul>
            )}
            <div className="md:mt-auto">
              <GuessInput
                names={names}
                tried={session.wrongGuesses}
                disabled={loading}
                onGuess={submitGuess}
                onSkip={skip}
              />
            </div>
          </>
        )}

        {session && !playing && !loading && (
          <>
            <ResultPanel session={session} stats={me?.stats ?? null} runBest={runBest} onNext={() => void next()} />
            <div className="hidden md:mt-auto md:block">
              <ShadowHistory
                step={session.step}
                maxSteps={session.maxSteps}
                thumbnails={thumbnails}
                viewing={null}
                onView={() => {}}
                interactive={false}
              />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
