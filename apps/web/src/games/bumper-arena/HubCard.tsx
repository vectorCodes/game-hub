// Bumper Arena's tile on the GameHub page: a gingham plate seen from above with rings on it
// and one flying off the edge, drawn as a print (SVG, no three.js, so the hub stays light),
// and a line of status.
import { useEffect, useState } from "react";
import { BUMPER_MAPS, BUMPER_MODIFIERS, bumperDay, type BumperDailyView } from "@shadow/shared";
import { api } from "../../api/client";
import { CoverFrame } from "../../components/CoverFrame";
import { savedDaily, today } from "./guest";

const RINGS: [number, number, string][] = [
  [160, 118, "#d9582c"],
  [228, 140, "#2f8a73"],
  [196, 92, "#cc922f"],
];

export function BumperArenaCover() {
  const day = bumperDay(today());
  return (
    <CoverFrame number="05" title="Bumper Arena" meta={`Gauntlet #${day.number}`} caption="Party · bump them off">
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="ba-gingham" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#f3ead9" />
            <rect width="12" height="24" fill="#d9582c" fillOpacity="0.35" />
            <rect width="24" height="12" fill="#d9582c" fillOpacity="0.35" />
          </pattern>
        </defs>
        <ellipse cx="200" cy="138" rx="150" ry="70" fill="#2a2216" fillOpacity="0.12" />
        <ellipse cx="200" cy="128" rx="150" ry="70" fill="url(#ba-gingham)" stroke="#2a2216" strokeOpacity="0.35" />
        {RINGS.map(([x, y, c], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 5} rx="22" ry="11" fill="#2a2216" fillOpacity="0.18" />
            <ellipse cx={x} cy={y} rx="22" ry="12" fill={c} />
            <ellipse cx={x} cy={y - 1} rx="10" ry="5" fill="#2a2216" fillOpacity="0.55" />
          </g>
        ))}
        {/* The one going over the edge, with a little bonk. */}
        <g className="cover-fling">
          <ellipse cx="330" cy="70" rx="20" ry="11" fill="#3d6f8f" transform="rotate(-24 330 70)" />
          <ellipse cx="330" cy="69" rx="9" ry="4.5" fill="#2a2216" fillOpacity="0.55" transform="rotate(-24 330 70)" />
        </g>
        <path d="M262 112 l14 -6 M266 124 l16 0 M262 136 l14 6" stroke="#cc922f" strokeWidth="3" strokeLinecap="round" />
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
