// Sky Climb on the player's profile: best floor, summits, streak, coins and achievements.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CLIMB_ACHIEVEMENTS, type ClimbProfileView } from "@shadow/shared";
import { api } from "../../api/client";
import { SKY_CLIMB_HOME } from "./config";

function Tile({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/3 p-4 ring-1 ring-white/10 sm:p-5">
      <div className={`font-display text-3xl font-bold tabular-nums sm:text-4xl ${accent ? "text-moss-300 text-glow" : "text-white"}`}>{value}</div>
      <div className="mt-1 text-xs font-medium tracking-wide text-stone-400 uppercase">{label}</div>
    </div>
  );
}

export function SkyClimbProfileSection() {
  const [profile, setProfile] = useState<ClimbProfileView | null>(null);
  useEffect(() => {
    api<ClimbProfileView>("/api/sky-climb/profile").then(setProfile, () => {});
  }, []);
  if (!profile) return null;
  const done = profile.achievements.filter((a) => a.unlocked).length;

  return (
    <section className="animate-rise space-y-3 [animation-delay:400ms]">
      <div className="flex items-baseline justify-between pt-4">
        <h2 className="font-display text-xl font-semibold">Sky Climb</h2>
        <span className="text-sm text-stone-400">
          <Link to={SKY_CLIMB_HOME} className="text-moss-300 hover:underline">
            Climb today&rsquo;s tower →
          </Link>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Best floor" value={profile.metrics.bestFloor} />
        <Tile label="Summits" value={profile.metrics.summits} />
        <Tile label="Climb streak" value={`${profile.currentStreak}🔥`} accent />
        <Tile label="Coins" value={`🪙 ${profile.coins.balance}`} />
      </div>
      <div className="rounded-3xl bg-white/3 p-5 ring-1 ring-white/10 sm:p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold">Achievements</span>
          <span className="text-xs text-stone-500">
            {done} of {profile.achievements.length}
          </span>
        </div>
        <ul className="flex flex-wrap gap-2">
          {CLIMB_ACHIEVEMENTS.map((def) => {
            const unlocked = profile.achievements.find((a) => a.id === def.id)?.unlocked;
            return (
              <li
                key={def.id}
                title={`${def.name}: ${def.description}`}
                className={`grid h-12 w-12 place-items-center rounded-xl text-2xl ring-1 ${unlocked ? "bg-moss-500/15 ring-moss-400/40" : "bg-white/[0.03] opacity-40 grayscale ring-white/10"}`}
              >
                {def.emoji}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
