// Sky Climb's tile on the GameHub page: a painted tower (no three.js, so the hub stays
// light) and a line of live status.
import { useEffect } from "react";
import { useClimb } from "./store";

/** Platforms zig-zagging up through the day: [left %, bottom %, width %, colour]. */
const STEPS: [number, number, number, string][] = [
  [8, 6, 26, "#79c66b"],
  [44, 18, 18, "#79c66b"],
  [16, 31, 16, "#5fae5e"],
  [52, 43, 14, "#e9b066"],
  [26, 55, 12, "#e9b066"],
  [58, 66, 12, "#eef0ff"],
  [34, 77, 10, "#9aa6c4"],
  [56, 88, 14, "#eef0ff"],
];

export function SkyClimbCover() {
  return (
    <div className="relative h-full min-h-64 overflow-hidden rounded-2xl bg-[linear-gradient(0deg,#cde9fb_0%,#5fb2f2_25%,#f2b27a_48%,#a674b8_66%,#2c3652_82%,#070b24_100%)] md:min-h-80">
      {/* Stars at the top of the sky. */}
      {[12, 30, 62, 78, 90, 46].map((x, i) => (
        <span key={x} aria-hidden className="absolute h-1 w-1 animate-twinkle rounded-full bg-white" style={{ left: `${x}%`, top: `${4 + (i % 3) * 5}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
      {/* The column. */}
      <div aria-hidden className="absolute inset-y-0 left-[38%] w-[12%] bg-gradient-to-b from-[#3d4a6b] via-[#b0754d] to-[#8a5a3a] opacity-70" />
      {STEPS.map(([left, bottom, width, color], i) => (
        <div
          key={i}
          aria-hidden
          className="absolute h-[5%] animate-drift rounded-md shadow-[0_8px_16px_-8px_rgba(0,0,0,0.6)]"
          style={{
            left: `${left}%`,
            bottom: `${bottom}%`,
            width: `${width}%`,
            background: `linear-gradient(180deg, ${color} 0 45%, #b87149 45% 100%)`,
            animationDelay: `${i * 0.35}s`,
          }}
        />
      ))}
      <span aria-hidden className="absolute bottom-[48%] left-[55%] animate-drift text-3xl drop-shadow-lg [animation-delay:1.4s]">
        🧗
      </span>
      <span aria-hidden className="absolute bottom-[93%] left-[60%] text-2xl">
        🏁
      </span>
      <span className="absolute top-4 left-4 rounded-full bg-stone-950/80 px-3 py-1 text-xs font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur">
        New · Daily tower
      </span>
      <span className="absolute top-4 right-4 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">3D</span>
    </div>
  );
}

export function SkyClimbStatus() {
  const daily = useClimb((s) => s.daily);
  const loadDaily = useClimb((s) => s.loadDaily);
  useEffect(() => {
    if (!daily) void loadDaily();
  }, [daily, loadDaily]);
  if (!daily) return <span>A new tower every day</span>;
  return (
    <span>
      Tower #{daily.number} ·{" "}
      {daily.myBest ? (
        <span className="text-moss-300">your best: floor {daily.myBest.floor}</span>
      ) : (
        <span className="text-stone-200">{daily.climbers ? `${daily.climbers} climbing today` : "be the first up today"}</span>
      )}
    </span>
  );
}
