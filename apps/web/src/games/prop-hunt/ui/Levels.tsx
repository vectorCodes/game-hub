// Levels in the lobby: your level and XP, the taunt picker (locked ones show the level that
// unlocks them), and on the podium what the match earned you.
import { useState } from "react";
import { HUNT_STARTER_TAUNTS, HUNT_TAUNTS, type HuntTauntId } from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { play, type Sound } from "../../../lib/sound";
import { useHuntProgress } from "../progress";

const tauntName = (id: string) => HUNT_TAUNTS.find((t) => t.id === id)?.name ?? id;

export function LevelBadge({ level, className = "" }: { level: number | null; className?: string }) {
  if (level === null) return null;
  return <span className={`shrink-0 rounded-full bg-[#7ec8ff]/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#9ed6ff] tabular-nums ${className}`}>Lv {level}</span>;
}

function XpBar({ xp, from, to }: { xp: number; from: number; to: number }) {
  const k = Math.max(0, Math.min(1, (xp - from) / (to - from || 1)));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-[#7ec8ff] transition-[width] duration-1000 ease-out" style={{ width: `${k * 100}%` }} />
    </div>
  );
}

/** Taps play the sound; signed in, they also pick it (pick several and they shuffle). */
export function TauntPicker() {
  const signedIn = useAuth((s) => s.user !== null);
  const signIn = useAuth((s) => s.signIn);
  const progress = useHuntProgress((s) => s.progress);
  const pick = useHuntProgress((s) => s.pick);
  const [error, setError] = useState<string | null>(null);
  const picked: HuntTauntId[] = progress?.taunts ?? HUNT_STARTER_TAUNTS;
  const level = progress?.level ?? 1;

  const toggle = async (id: HuntTauntId) => {
    play(id as Sound);
    if (!progress) return;
    const next = picked.includes(id) ? picked.filter((t) => t !== id) : [...picked, id];
    // Always at least one.
    if (next.length === 0) return;
    setError((await pick(next)) ? "Couldn't save that. Try again." : null);
  };

  return (
    <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      {progress ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-lg font-bold">Level {progress.level}</span>
            <span className="text-xs text-stone-400 tabular-nums">
              {progress.xp - progress.levelXp} / {progress.nextLevelXp - progress.levelXp} XP to level {progress.level + 1}
            </span>
          </div>
          <div className="mt-2">
            <XpBar xp={progress.xp} from={progress.levelXp} to={progress.nextLevelXp} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-stone-300">{signedIn ? "Loading your level…" : "Sign in to earn XP, level up and unlock new taunts."}</span>
          {!signedIn && (
            <button onClick={() => void signIn()} className="btn btn-secondary h-8! shrink-0 px-3! text-xs">
              Sign in
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between">
        <span className="label-mono text-stone-400">Your taunt</span>
        <span className="text-xs text-stone-400">{picked.length > 1 ? `Shuffles between ${picked.length}` : tauntName(picked[0])}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {HUNT_TAUNTS.map((t) => {
          const locked = t.level > level;
          const on = picked.includes(t.id);
          if (locked)
            return (
              <div key={t.id} className="flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-xs text-stone-500 ring-1 ring-white/5">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0">🔒 Lv {t.level}</span>
              </div>
            );
          return (
            <button
              key={t.id}
              onClick={() => void toggle(t.id)}
              className={`flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-left text-xs transition active:scale-95 ${
                on ? "bg-lamp-300/20 text-lamp-100 ring-1 ring-lamp-300/50" : "bg-white/[0.04] text-stone-200 ring-1 ring-white/10 hover:bg-white/[0.08]"
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span aria-hidden className="shrink-0">
                {on ? "✓" : "▶"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-stone-500">{progress ? "Tap to hear it and pick it. Pick several to shuffle." : "Tap to hear them."}</p>
      {error && <p className="mt-1 text-xs text-ember-300">{error}</p>}
    </div>
  );
}

/** On the podium: the XP this match earned, a level-up, and anything it unlocked (one tap to use it). */
export function XpPanel() {
  const signedIn = useAuth((s) => s.user !== null);
  const signIn = useAuth((s) => s.signIn);
  const gain = useHuntProgress((s) => s.gain);
  const progress = useHuntProgress((s) => s.progress);
  const pick = useHuntProgress((s) => s.pick);

  if (!signedIn)
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-white/10">
        <span className="text-stone-300">Sign in to keep the XP from your matches.</span>
        <button onClick={() => void signIn()} className="btn btn-secondary h-8! shrink-0 px-3! text-xs">
          Sign in
        </button>
      </div>
    );
  if (gain === undefined) return <p className="mt-4 text-center text-sm text-stone-400">Saving your XP…</p>;
  if (gain === null) return <p className="mt-4 text-center text-sm text-stone-400">Your XP couldn't be saved this time.</p>;

  const levelled = gain.level > gain.levelBefore;
  return (
    <div className={`mt-4 animate-rise rounded-2xl px-4 py-3 ring-1 ${levelled ? "bg-[#7ec8ff]/10 ring-[#7ec8ff]/40" : "bg-white/[0.04] ring-white/10"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">{levelled ? `Level ${gain.level}! 🎉` : `Level ${gain.level}`}</span>
        <span className="font-mono text-sm text-[#9ed6ff] tabular-nums">+{gain.gained} XP</span>
      </div>
      <div className="mt-2">
        <XpBar xp={gain.xp} from={gain.levelXp} to={gain.nextLevelXp} />
      </div>
      <p className="mt-1 text-xs text-stone-400 tabular-nums">
        {gain.nextLevelXp - gain.xp} XP to level {gain.level + 1}
      </p>
      {gain.unlocked.map((id) => {
        const using = progress?.taunts.includes(id);
        return (
          <div key={id} className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm">
            <span>
              Unlocked: <b>{tauntName(id)}</b>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button onClick={() => play(id as Sound)} className="rounded-lg px-2 py-1 text-xs ring-1 ring-white/20" aria-label={`Play ${tauntName(id)}`}>
                ▶
              </button>
              {progress && (
                <button
                  disabled={using}
                  onClick={() => void pick([...progress.taunts, id])}
                  className="rounded-lg bg-lamp-300/20 px-2 py-1 text-xs text-lamp-100 ring-1 ring-lamp-300/40 disabled:opacity-60"
                >
                  {using ? "In use" : "Use it"}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
