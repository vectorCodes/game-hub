import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { LeaderboardView, SessionView, StatsView } from "@shadow/shared";
import { api } from "../../../api/client";
import { GoogleIcon } from "../../../auth/AuthMenu";
import { useAuth } from "../../../auth/store";

interface Props {
  session: SessionView;
  /** Signed-in player's stats, or null for guests. */
  stats: StatsView | null;
  onNext: () => void;
}

export function shareText(session: SessionView): string {
  const won = session.status === "won";
  const misses = session.wrongGuesses.length;
  const grid = "🟥".repeat(misses) + (won ? "🟩" : "") + "⬛".repeat(session.maxSteps - misses - (won ? 1 : 0));
  const title = session.puzzleNumber ? `Shadow Guess #${session.puzzleNumber}` : "Shadow Guess";
  const result = won ? `${misses + 1}/${session.maxSteps}` : `X/${session.maxSteps}`;
  return `${title} ${result}\n${grid}\n${location.origin}/games/shadow-guess`;
}

function Stat({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const body = (
    <>
      <div className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      <div className="text-[11px] font-medium tracking-wide text-stone-400 uppercase">{label}</div>
    </>
  );
  const cls = "rounded-2xl bg-white/[0.04] px-3 py-2.5 text-center ring-1 ring-white/10";
  return to ? (
    <Link to={to} className={`${cls} transition hover:bg-white/[0.08]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ResultPanel({ session, stats, onNext }: Props) {
  const { enabled, user, signIn } = useAuth();
  const [copied, setCopied] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const won = session.status === "won";
  const misses = session.wrongGuesses.length;
  const text = shareText(session);

  // Signed-in daily players see where today's result ranks.
  const rankable = session.mode === "daily" && stats !== null;
  useEffect(() => {
    if (!rankable) return;
    api<LeaderboardView>("/api/leaderboard?period=daily").then(
      (b) => b.me && setRank(b.me.rank),
      () => {},
    );
  }, [rankable, session.sessionId]);

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

  return (
    <div role="status" className="flex animate-rise flex-col gap-4">
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            won ? "bg-moss-400/10 text-moss-300 ring-moss-400/20" : "bg-ember-400/10 text-ember-300 ring-ember-400/20"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${won ? "bg-moss-400" : "bg-ember-400"}`} />
          {won ? `Solved on angle ${misses + 1}` : "Out of angles"}
        </span>
        <h2 className="mt-2 bg-gradient-to-br from-white via-lamp-200 to-lamp-400 bg-clip-text font-display text-3xl font-bold tracking-tight break-words text-transparent sm:text-4xl">
          {session.answer}
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          {won ? "Nicely spotted. Drag the object to look around it." : "It was hiding in plain sight. Drag to look around it."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Score" value={session.score ?? 0} />
        {stats ? (
          <>
            <Stat label="Streak" value={`${stats.currentStreak}🔥`} to="/profile" />
            <Stat label={rank ? "Today" : "Won"} value={rank ? `#${rank}` : stats.won} to={rank ? "/leaderboard" : "/profile"} />
          </>
        ) : (
          <>
            <Stat label="Angles" value={`${won ? misses + 1 : "X"}/${session.maxSteps}`} />
            <Stat label="Hint" value={session.hintUsed ? "Yes" : "No"} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
        <span className="text-base tracking-[0.15em] sm:text-lg sm:tracking-[0.2em]">{text.split("\n")[1]}</span>
        <button onClick={share} className="text-sm font-medium text-moss-300 transition hover:text-moss-200">
          {copied ? "Copied ✓" : "Share"}
        </button>
      </div>

      <button
        onClick={onNext}
        className="rounded-2xl btn-primary py-3 font-semibold  active:scale-[0.98]"
      >
        {session.mode === "daily" ? "Keep playing: free mode →" : "Next shadow →"}
      </button>

      {enabled && !user && (
        <button
          onClick={() => void signIn()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.04] py-2.5 text-sm text-stone-200 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
        >
          <GoogleIcon />
          Sign in to save your streak
        </button>
      )}
    </div>
  );
}
