// What's laid over the course: the hole, par and strokes, toasts, the first-shot hint,
// camera buttons, and the panels after each hole and at the end of the round.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { formatToPar, PUTT_MAX_STROKES, puttScoreEmoji, puttScoreName, puttShareText, puttTotals } from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { useSound } from "../../../lib/sound";
import { PUTT_ISLES_HOME } from "../config";
import { view } from "../input";
import { usePutt } from "../store";

function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-stone-950/70 px-3 py-1.5 text-sm font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur-md ${className}`}>
      {children}
    </span>
  );
}

function RoundButton({ label, children, onHold, onClick, active }: { label: string; children: ReactNode; onHold?: (on: boolean) => void; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-12 w-12 place-items-center rounded-full text-lg ring-1 backdrop-blur-md transition-colors ${
        active ? "bg-lamp-300 text-ink ring-lamp-200" : "bg-stone-950/70 text-stone-100 ring-white/10 hover:bg-stone-900/80"
      }`}
      onPointerDown={() => onHold?.(true)}
      onPointerUp={() => onHold?.(false)}
      onPointerLeave={() => onHold?.(false)}
      onPointerCancel={() => onHold?.(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Toast() {
  const toast = usePutt((s) => s.toast);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast.id);
    const t = setTimeout(() => setShown(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || shown !== toast.id) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
      <div key={toast.id} className="animate-rise rounded-2xl bg-stone-950/80 px-5 py-3 text-center ring-1 ring-white/10 backdrop-blur-md">
        <div className="font-display text-lg font-semibold">{toast.title}</div>
        {toast.subtitle && <div className="text-sm text-stone-300">{toast.subtitle}</div>}
      </div>
    </div>
  );
}

function Panel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-stone-950/30 p-4">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"} animate-rise rounded-3xl bg-stone-950/90 p-6 ring-1 ring-white/10 backdrop-blur-xl`}>{children}</div>
    </div>
  );
}

function HolePanel() {
  const hole = usePutt((s) => s.holes[s.holeIndex]);
  const strokes = usePutt((s) => s.strokes);
  const pickedUp = usePutt((s) => s.pickedUp);
  const last = usePutt((s) => s.holeIndex + 1 >= s.holes.length);
  const nextHole = usePutt((s) => s.nextHole);
  const name = pickedUp ? "Out of strokes" : puttScoreName(strokes, hole.par);
  const ace = !pickedUp && strokes === 1;
  return (
    <Panel>
      <div className="text-center">
        <div className="text-4xl">{pickedUp ? "😅" : puttScoreEmoji(strokes, hole.par)}</div>
        <h2 className={`mt-2 font-display text-3xl font-semibold ${ace ? "text-lamp-300" : ""}`}>{name}</h2>
        <p className="mt-2 text-stone-300">
          {strokes} {strokes === 1 ? "stroke" : "strokes"} · par {hole.par}
        </p>
        {pickedUp && <p className="mt-1 text-sm text-stone-400">A hole ends after {PUTT_MAX_STROKES} strokes, so you move on to the next one.</p>}
        <button type="button" className="btn btn-primary mt-6 w-full" onClick={nextHole} autoFocus>
          {last ? "See the scorecard" : "Next hole"} <span aria-hidden>→</span>
        </button>
      </div>
    </Panel>
  );
}

function Scorecard() {
  const holes = usePutt((s) => s.holes);
  const scores = usePutt((s) => s.scores);
  const mode = usePutt((s) => s.mode);
  const number = usePutt((s) => s.number);
  const daily = usePutt((s) => s.daily);
  const setMode = usePutt((s) => s.setMode);
  const begin = usePutt((s) => s.begin);
  const signedIn = useAuth((s) => !!s.user);
  const [copied, setCopied] = useState(false);
  const pars = holes.map((h) => h.par);
  const t = puttTotals(scores, pars);
  const rank = mode === "daily" && daily?.me ? daily.me.rank : null;
  const text = puttShareText({ number: mode === "daily" ? number : null, strokes: scores, pars, url: `${location.origin}${PUTT_ISLES_HOME}` });

  async function share() {
    try {
      // Phones get the native share sheet; desktops copy to the clipboard.
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share dismissed or clipboard blocked.
    }
  }

  const practice = () => {
    setMode("practice");
    void begin();
  };

  return (
    <Panel wide>
      <p className="eyebrow text-center">{mode === "daily" ? `Course #${number}` : "Practice round"}</p>
      <h2 className="mt-2 text-center font-display text-5xl font-semibold">{formatToPar(t.toPar)}</h2>
      <p className="mt-1 text-center text-stone-300">
        {t.strokes} strokes · par {t.par} · {t.points} pts
        {rank && <span className="text-moss-300"> · #{rank} today</span>}
      </p>
      <p className="mt-3 text-center text-2xl tracking-widest">{scores.map((s, i) => puttScoreEmoji(s, pars[i])).join("")}</p>
      <table className="mt-5 w-full text-sm">
        <thead className="text-stone-400">
          <tr>
            <th className="py-1 text-left font-medium">Hole</th>
            <th className="py-1 text-right font-medium">Par</th>
            <th className="py-1 text-right font-medium">Strokes</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((h, i) => (
            <tr key={h.id} className="border-t border-white/5">
              <td className="py-1.5">
                <span className="mr-1.5">{h.island?.emoji}</span>
                {i + 1}. {h.name}
              </td>
              <td className="py-1.5 text-right tabular-nums text-stone-400">{h.par}</td>
              <td className="py-1.5 text-right tabular-nums">
                {scores[i] ?? "–"} <span className="ml-1">{scores[i] ? puttScoreEmoji(scores[i], h.par) : ""}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-primary mt-6 w-full" onClick={share}>
        {copied ? "Copied!" : "Share your card"}
      </button>
      <div className="mt-3 flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" onClick={practice}>
          {mode === "daily" ? "Practice round" : "Play again"}
        </button>
        <Link to={mode === "daily" ? "/leaderboard?game=putt-isles" : PUTT_ISLES_HOME} className="btn btn-secondary flex-1">
          {mode === "daily" ? "Leaderboard" : "Done"}
        </Link>
      </div>
      {mode === "daily" && !signedIn && <p className="mt-4 text-center text-xs text-stone-400">Sign in to put your rounds on the leaderboard.</p>}
    </Panel>
  );
}

export function Hud() {
  const hole = usePutt((s) => s.holes[s.holeIndex]);
  const holeIndex = usePutt((s) => s.holeIndex);
  const count = usePutt((s) => s.holes.length);
  const strokes = usePutt((s) => s.strokes);
  const phase = usePutt((s) => s.phase);
  const overview = usePutt((s) => s.overview);
  const setOverview = usePutt((s) => s.setOverview);
  const scores = usePutt((s) => s.scores);
  const holes = usePutt((s) => s.holes);
  const { muted, toggle } = useSound();
  const firstShot = holeIndex === 0 && strokes === 0 && phase === "aim";
  const done = scores.slice(0, holeIndex);
  const soFar = puttTotals(done, holes.map((h) => h.par));

  if (phase === "loading") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-stone-950/60">
        <div className="font-display text-xl font-semibold">Teeing up…</div>
      </div>
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-col items-start gap-2">
          <Chip>
            <span className="text-stone-400">
              Hole {holeIndex + 1}/{count}
            </span>
            <span className="font-display font-semibold">{hole.name}</span>
          </Chip>
          <Chip>
            {hole.island && (
              <span>
                {hole.island.emoji} {hole.island.name} ·
              </span>
            )}
            Par {hole.par}
          </Chip>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Chip className="text-base">
              <span className="text-stone-400">Strokes</span>
              <span className="font-display text-lg font-semibold tabular-nums">{strokes}</span>
            </Chip>
            <button type="button" onClick={toggle} aria-label={muted ? "Sound on" : "Sound off"} className="grid h-9 w-9 place-items-center rounded-full bg-stone-950/70 ring-1 ring-white/10 backdrop-blur-md">
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
          {done.length > 0 && (
            <Chip>
              <span className="text-stone-400">Round</span>
              <span className="font-display font-semibold tabular-nums">{formatToPar(soFar.toPar)}</span>
            </Chip>
          )}
        </div>
      </div>

      <Toast />

      {firstShot && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
          <div className="animate-rise rounded-full bg-stone-950/75 px-4 py-2 text-center text-sm text-stone-100 ring-1 ring-white/10 backdrop-blur-md">
            Drag back from anywhere to aim · let go to putt
          </div>
        </div>
      )}

      {(phase === "aim" || phase === "rolling") && (
        <div className="absolute right-3 bottom-3 flex gap-2 sm:right-4 sm:bottom-4">
          <RoundButton label="Turn camera left" onHold={(on) => (view.buttonTurn = on ? -1 : 0)}>
            ⟲
          </RoundButton>
          <RoundButton label="Turn camera right" onHold={(on) => (view.buttonTurn = on ? 1 : 0)}>
            ⟳
          </RoundButton>
          <RoundButton label="Overview" active={overview} onClick={() => setOverview(!overview)}>
            🗺
          </RoundButton>
        </div>
      )}

      {phase === "sunk" && <HolePanel />}
      {phase === "done" && <Scorecard />}
    </>
  );
}
