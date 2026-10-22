// Sky Climb on the player's profile: best floor, summits, streak, coins, and the
// achievements as a row of seals.
import { useEffect, useState } from "react";
import { CLIMB_ACHIEVEMENTS, type ClimbProfileView } from "@shadow/shared";
import { api } from "../../api/client";
import { ChapterHeader, StatStrip } from "../../components/Editorial";
import { SKY_CLIMB_HOME, TOP } from "./config";

export function SkyClimbProfileSection() {
  const [profile, setProfile] = useState<ClimbProfileView | null>(null);
  useEffect(() => {
    api<ClimbProfileView>("/api/sky-climb/profile").then(setProfile, () => {});
  }, []);
  if (!profile) return null;
  const done = profile.achievements.filter((a) => a.unlocked).length;

  return (
    <section className="animate-rise [animation-delay:200ms]">
      <ChapterHeader number="02" title="Sky Climb" note={`One tower a day, ${TOP} floors.`} link={{ to: SKY_CLIMB_HOME, label: "Today's tower" }} />
      <StatStrip
        stats={[
          { label: "Best floor", value: profile.metrics.bestFloor },
          { label: "Summits", value: profile.metrics.summits },
          { label: "Climb streak", value: profile.currentStreak, accent: true },
          { label: "Coins", value: profile.coins.balance },
        ]}
      />
      <div className="pt-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <span className="font-display text-lg font-light uppercase">Achievements</span>
          <span className="label-mono text-stone-500">
            {done} of {profile.achievements.length}
          </span>
        </div>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
          {CLIMB_ACHIEVEMENTS.map((def) => {
            const unlocked = profile.achievements.find((a) => a.id === def.id)?.unlocked;
            return (
              <li key={def.id} title={`${def.name}: ${def.description}`} className="flex flex-col items-center text-center">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full text-2xl sm:h-16 sm:w-16 ${
                    unlocked ? "bg-gold/20 ring-2 ring-gold" : "border border-dashed border-white/25 opacity-50 grayscale"
                  }`}
                >
                  {def.emoji}
                </span>
                <span className={`mt-2 line-clamp-2 font-serif text-xs leading-tight ${unlocked ? "text-stone-200" : "text-stone-500"}`}>{def.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
