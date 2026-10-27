// Bumper Arena's tile on the GameHub page: a neon arena with bumpers colliding and one knocked
// off the edge, drawn in SVG (no three.js, so the hub stays light), and a line of status.
import { useEffect, useState } from "react";
import { BUMPER_MAPS, BUMPER_MODIFIERS, bumperDay, type BumperDailyView } from "@shadow/shared";
import { api } from "../../api/client";
import { CoverFrame } from "../../components/CoverFrame";
import { savedDaily, today } from "./guest";

/** A bumper seen from above and in front: skirt, shell, a shine, and the seat. */
function Bumper({ x, y, body, skirt }: { x: number; y: number; body: string; skirt: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 11} rx="24" ry="8" fill="#000" fillOpacity="0.35" />
      <ellipse cx={x} cy={y + 4} rx="23" ry="11" fill={skirt} />
      <ellipse cx={x} cy={y} rx="22" ry="11" fill={body} />
      <ellipse cx={x - 4} cy={y - 4} rx="11" ry="3.5" fill="#fff" fillOpacity="0.38" />
      <ellipse cx={x + 4} cy={y - 1} rx="8" ry="5" fill="#0a0e18" fillOpacity="0.55" />
    </g>
  );
}

/**
 * Key art for the party game: a neon arena floating over the dark, two bumpers meeting in
 * a burst of sparks, and a third knocked clean off the edge.
 */
export function BumperArenaCover() {
  return (
    <CoverFrame label="Bumpers collide on a glowing arena floating in the dark; one is knocked off the edge.">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="ba-bg" cx="0.5" cy="0.75" r="0.85">
            <stop offset="0" stopColor="#14304a" />
            <stop offset="0.6" stopColor="#0a1426" />
            <stop offset="1" stopColor="#04070f" />
          </radialGradient>
          <radialGradient id="ba-floor" cx="0.5" cy="0.45">
            <stop offset="0" stopColor="#2b3a5c" />
            <stop offset="1" stopColor="#141c30" />
          </radialGradient>
          <linearGradient id="ba-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2540" />
            <stop offset="1" stopColor="#070b16" />
          </linearGradient>
          <filter id="ba-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="ba-rim" x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        <rect width="400" height="260" fill="url(#ba-bg)" />
        {[
          [40, 40], [92, 22], [356, 30], [376, 118], [24, 128], [70, 226], [338, 232], [150, 30],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 0.8 : 1.3} fill="#9fe9ff" fillOpacity={0.25 + (i % 4) * 0.1} />
        ))}

        {/* Light spilling out under the arena. */}
        <ellipse cx="200" cy="196" rx="170" ry="34" fill="#45d6ee" fillOpacity="0.32" filter="url(#ba-glow)" />

        {/* The arena: side band, floor, markings, and the lit rim. */}
        <path d="M50 150 V168 A150 60 0 0 0 350 168 V150 Z" fill="url(#ba-side)" />
        <ellipse cx="200" cy="168" rx="150" ry="60" fill="none" stroke="#45d6ee" strokeOpacity="0.25" />
        <ellipse cx="200" cy="150" rx="150" ry="60" fill="url(#ba-floor)" />
        <ellipse cx="200" cy="150" rx="102" ry="40" fill="none" stroke="#6fe3f2" strokeOpacity="0.18" />
        <ellipse cx="200" cy="150" rx="30" ry="12" fill="none" stroke="#6fe3f2" strokeOpacity="0.28" />
        <path d="M200 90 V210 M50 150 H350" stroke="#6fe3f2" strokeOpacity="0.07" />
        <ellipse cx="200" cy="150" rx="150" ry="60" fill="none" stroke="#6fe3f2" strokeWidth="3" filter="url(#ba-rim)" />
        <ellipse cx="200" cy="150" rx="150" ry="60" fill="none" stroke="#c9f7ff" strokeWidth="1.2" />

        <Bumper x={126} y={176} body="#f2c063" skirt="#9a6a1f" />
        <Bumper x={174} y={150} body="#ff6a3d" skirt="#a3341a" />
        <Bumper x={226} y={140} body="#45d6ee" skirt="#1d7c91" />

        {/* The hit. */}
        <g stroke="#fff3c4" strokeWidth="2.2" strokeLinecap="round">
          <path d="M200 128 l0 -12 M207 131 l9 -8 M193 131 l-9 -8 M211 140 l11 0 M189 140 l-10 2" />
        </g>
        <circle cx="200" cy="138" r="5" fill="#fff8de" />
        <circle cx="200" cy="138" r="14" fill="#ffd27a" fillOpacity="0.35" filter="url(#ba-rim)" />

        {/* The one going over the edge. */}
        <g className="cover-fling">
          <g transform="rotate(-28 330 72)">
            <Bumper x={330} y={72} body="#ff7fae" skirt="#a23766" />
          </g>
        </g>
      </svg>
    </CoverFrame>
  );
}

/** Today's Gauntlet as the server sees it, shared by the tile and the landing page. */
let cached: Promise<BumperDailyView | null> | null = null;
export function loadBumperDaily(fresh = false): Promise<BumperDailyView | null> {
  if (!cached || fresh) cached = api<BumperDailyView>("/api/bumper-arena/daily").catch(() => null);
  return cached;
}

export function useBumperDaily(): BumperDailyView | null {
  const [daily, setDaily] = useState<BumperDailyView | null>(null);
  useEffect(() => {
    let live = true;
    void loadBumperDaily().then((d) => live && setDaily(d));
    return () => {
      live = false;
    };
  }, []);
  return daily;
}

export function BumperArenaStatus() {
  const board = useBumperDaily();
  const day = bumperDay(today());
  const mine = savedDaily();
  return (
    <span>
      Gauntlet #{day.number} ·{" "}
      {mine ? (
        <span className="text-moss-300">
          {mine.waves} {mine.waves === 1 ? "wave" : "waves"} cleared
        </span>
      ) : (
        <span className="text-stone-200">
          {BUMPER_MAPS[day.map]?.name}, {BUMPER_MODIFIERS[day.modifier].name}
          {board?.players ? ` · ${board.players} played` : ""}
        </span>
      )}
    </span>
  );
}
