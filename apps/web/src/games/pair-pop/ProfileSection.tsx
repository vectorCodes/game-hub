// Pair Pop on the player's profile: levels cleared, stars, today's board, and the seven
// levels as small tiles with their stars.
import { useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/store";
import { ChapterHeader, StatStrip } from "../../components/Editorial";
import { LEVELS, PAIR_POP_HOME, PAIR_POP_PATH } from "./config";
import { levelUnlocked, savedDaily, savedStars } from "./guest";
import { usePairPopProgress } from "./progress";

export function PairPopProfileSection() {
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  const board = usePairPopProgress((s) => s.daily);
  // Re-read local storage once server progress has been merged into it.
  usePairPopProgress((s) => s.version);
  useEffect(() => {
    if (synced) void usePairPopProgress.getState().load();
  }, [synced, userId]);

  const stars = savedStars();
  const cleared = LEVELS.filter((_, i) => (stars[i] ?? 0) > 0).length;
  const totalStars = LEVELS.reduce((n, _, i) => n + (stars[i] ?? 0), 0);
  const today = savedDaily();
  const rank = board?.mine?.rank;

  return (
    <section data-game="pair-pop" className="animate-rise [animation-delay:280ms]">
      <ChapterHeader number="03" title="Pair Pop" note="Flip the tiles, find the twins." link={{ to: PAIR_POP_HOME, label: "Today's board" }} />
      <StatStrip
        stats={[
          { label: "Levels cleared", value: `${cleared}/${LEVELS.length}` },
          { label: "Stars", value: `${totalStars}/${LEVELS.length * 3}` },
          { label: "Today's score", value: today ? today.score : "—", accent: !!today },
          { label: "Today's rank", value: rank ? `#${rank}` : "—" },
        ]}
      />
      <div className="pt-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-bold tracking-tight">Levels</span>
          <span className="label-mono text-stone-500">Three stars, barely a wrong move</span>
        </div>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
          {LEVELS.map((level, i) => {
            const open = levelUnlocked(i, stars);
            const got = stars[i] ?? 0;
            const tile = (
              <div
                className={`flex aspect-square flex-col items-center justify-center rounded-(--radius-ui) text-center transition-[transform,box-shadow] duration-300 ease-mirai ${
                  open ? "surface hover:-translate-y-0.5 hover:shadow-glow" : "border border-dashed border-white/20"
                }`}
              >
                <span className={`font-display text-2xl leading-none font-extrabold sm:text-3xl ${open ? "" : "text-stone-600"}`}>{i + 1}</span>
                <span className="mt-1 text-xs tracking-tight sm:text-sm" aria-label={`${got} stars`}>
                  {[0, 1, 2].map((s) => (
                    <span key={s} className={s < got ? "text-lamp-400" : "text-white/20"}>
                      ★
                    </span>
                  ))}
                </span>
                <span className="mt-0.5 hidden font-mono text-[9px] tracking-wider text-stone-500 sm:block">
                  {level.cols}×{level.rows}
                </span>
              </div>
            );
            return (
              <li key={i}>
                {open ? (
                  <Link to={`${PAIR_POP_PATH}?level=${i + 1}`} aria-label={`Level ${i + 1}`} className="block">
                    {tile}
                  </Link>
                ) : (
                  tile
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
