// Bumper Arena on the player's profile: level and XP, the party record, and the best Daily
// Gauntlet run.
import { useEffect } from "react";
import { useAuth } from "../../auth/store";
import { ChapterHeader, StatStrip } from "../../components/Editorial";
import { useBumperProgress } from "./progress";

export function BumperProfileSection() {
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  const progress = useBumperProgress((s) => s.progress);
  useEffect(() => {
    if (synced) void useBumperProgress.getState().load();
  }, [synced, userId]);
  if (!progress) return null;
  const share = Math.max(0, Math.min(1, (progress.xp - progress.levelXp) / (progress.nextLevelXp - progress.levelXp || 1)));
  const best = progress.bestGauntlet;

  return (
    <section data-game="bumper-arena" className="animate-rise [animation-delay:360ms]">
      <ChapterHeader number="04" title="Bumper Arena" note="Bump them off the edge. Last ring rolling wins." link={{ to: "/games/bumper-arena", label: "Play" }} />
      <StatStrip
        stats={[
          { label: "Level", value: progress.level, accent: true },
          { label: "Party wins", value: progress.matches ? `${progress.wins}/${progress.matches}` : "—" },
          { label: "Knockouts", value: progress.kos },
          { label: "Best Gauntlet", value: best ? `${best.waves} ${best.waves === 1 ? "wave" : "waves"}` : "—" },
        ]}
      />
      <div className="pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-bold tracking-tight">Level {progress.level}</span>
          <span className="label-mono text-stone-500 tabular-nums">
            {progress.nextLevelXp - progress.xp} XP to level {progress.level + 1}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-stone-100/[0.06]">
          <div className="h-full rounded-full bg-accent shadow-glow-sm transition-[width] duration-700 ease-mirai" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-4 text-sm text-stone-400">
          {progress.roundsWon} {progress.roundsWon === 1 ? "round" : "rounds"} won · {progress.coins} coins earned in party matches
          {best ? ` · best Gauntlet score ${best.score}` : ""}
        </p>
      </div>
    </section>
  );
}
