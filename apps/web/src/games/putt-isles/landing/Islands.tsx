// Painted floating islands for the landing page: the big hero island, where a ball is putted
// into the cup on a loop, and a small island for each stage of the round.
import type { CSSProperties } from "react";
import { MOTION } from "./Sky";

/** The fairway on the hero island, tee to cup. The ball rolls along it. */
const FAIRWAY = "M178 276 C 240 302, 296 232, 356 244 S 428 262, 446 251";
const CUP = { x: 446, y: 251 };
/** One putt, as a share of the loop: aim, roll, drop, celebrate. */
const LOOP = 5.5;

/** Lets CSS transforms on an SVG element turn about its own box. */
const box = (origin: string): CSSProperties => ({ transformBox: "fill-box", transformOrigin: origin });

export function HeroIsland({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 560" className={className} role="img" aria-label="A floating island with a mini-golf hole, a windmill and a waterfall">
      <defs>
        <linearGradient id="pi-rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8714a" />
          <stop offset="0.45" stopColor="#6e4040" />
          <stop offset="1" stopColor="#2a1b3a" />
        </linearGradient>
        <radialGradient id="pi-grass" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#a6e77f" />
          <stop offset="1" stopColor="#5fae55" />
        </radialGradient>
        <linearGradient id="pi-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8f3ff" />
          <stop offset="0.7" stopColor="#7fd2f4" stopOpacity="0.8" />
          <stop offset="1" stopColor="#7fd2f4" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pi-halo">
          <stop offset="0" stopColor="#ffc6a0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffc6a0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="300" cy="290" rx="300" ry="230" fill="url(#pi-halo)" />

      {/* Rock chunks that broke away, floating below. */}
      <g className="animate-isle-bob [animation-delay:-3s]">
        <path d="M70 420 l26 -8 l10 20 l-22 22 z" fill="#5a3640" />
        <path d="M520 470 l22 -6 l6 16 l-18 16 z" fill="#4a2c40" />
      </g>
      <g className="animate-isle-bob [animation-delay:-6s]">
        <path d="M150 500 l18 -4 l4 14 l-14 10 z" fill="#3e2640" />
      </g>

      {/* The rock underneath, tapering to a point. */}
      <path d="M52 262 C 70 330, 150 360, 200 400 C 240 432, 268 512, 300 548 C 330 505, 352 440, 402 410 C 460 372, 530 330, 548 262 Z" fill="url(#pi-rock)" />
      <g fill="none" stroke="#2a1b3a" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round">
        <path d="M92 304 C 200 336, 400 336, 508 304" />
        <path d="M160 366 C 250 388, 350 388, 440 366" />
        <path d="M232 440 C 270 452, 330 452, 368 440" />
      </g>

      {/* Roots and vines hanging off the rim. */}
      <g fill="none" stroke="#3f7a3a" strokeWidth="3" strokeLinecap="round">
        <path className="animate-sway-soft" style={box("top")} d="M120 300 q-6 30 4 56 q6 18 -2 36" />
        <path className="animate-sway-soft [animation-delay:-2s]" style={box("top")} d="M250 318 q8 26 -2 50" />
        <path className="animate-sway-soft [animation-delay:-1s]" style={box("top")} d="M380 316 q-6 34 6 62 q4 12 -4 24" />
      </g>

      {/* The waterfall pouring off the right edge, with spray at its foot. */}
      <path d="M504 288 C 510 340, 514 400, 516 488" fill="none" stroke="url(#pi-water)" strokeWidth="16" strokeLinecap="round" />
      <path d="M504 288 C 510 340, 514 400, 516 488" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="5" strokeDasharray="8 12" strokeLinecap="round" className="animate-waterfall" />
      <g fill="#e6f8ff">
        <circle cx="510" cy="482" r="9" className="animate-twinkle" opacity="0.5" />
        <circle cx="526" cy="474" r="6" className="animate-twinkle [animation-delay:0.7s]" opacity="0.5" />
        <circle cx="500" cy="470" r="5" className="animate-twinkle [animation-delay:1.3s]" opacity="0.5" />
      </g>

      {/* Grass: its side, then its top, with the pond that feeds the waterfall. */}
      <ellipse cx="300" cy="270" rx="249" ry="62" fill="#3c8444" />
      <ellipse cx="300" cy="255" rx="250" ry="60" fill="url(#pi-grass)" />
      <ellipse cx="478" cy="270" rx="34" ry="9" fill="#7fd6f5" />
      <ellipse cx="472" cy="268" rx="14" ry="3" fill="#dff7ff" opacity="0.8" />

      {/* Windmill, at the back left. */}
      <path d="M108 252 L 118 196 L 132 196 L 142 252 Z" fill="#f2e3c8" />
      <path d="M113 200 L 125 182 L 137 200 Z" fill="#d9644f" />
      <rect x="120" y="230" width="10" height="20" rx="5" fill="#6e4040" />
      <g className="animate-tick" style={{ ...box("center"), animationDuration: "5s" }}>
        <rect x="123" y="150" width="4" height="80" rx="2" fill="#fff4e0" />
        <rect x="85" y="188" width="80" height="4" rx="2" fill="#fff4e0" />
        <rect x="127" y="154" width="9" height="32" fill="#f8cf72" opacity="0.85" />
        <rect x="114" y="196" width="9" height="32" fill="#f8cf72" opacity="0.85" />
        <rect x="89" y="179" width="32" height="9" fill="#f8cf72" opacity="0.85" />
        <rect x="129" y="192" width="32" height="9" fill="#f8cf72" opacity="0.85" />
      </g>
      <circle cx="125" cy="190" r="4" fill="#6e4040" />

      {/* Trees along the back. */}
      <g className="animate-sway-soft" style={{ ...box("bottom"), animationDuration: "6s" }}>
        <rect x="203" y="196" width="7" height="22" fill="#6e4040" />
        <circle cx="206" cy="186" r="20" fill="#3f8f4a" />
        <circle cx="196" cy="194" r="13" fill="#4ea256" />
      </g>
      <g className="animate-sway-soft [animation-delay:-2.5s]" style={{ ...box("bottom"), animationDuration: "7s" }}>
        <rect x="246" y="190" width="6" height="20" fill="#6e4040" />
        <path d="M249 150 L 268 196 L 230 196 Z" fill="#2f7a48" />
        <path d="M249 136 L 264 172 L 234 172 Z" fill="#3b8f52" />
      </g>
      <g className="animate-sway-soft [animation-delay:-1s]" style={{ ...box("bottom"), animationDuration: "6.5s" }}>
        <rect x="392" y="192" width="7" height="22" fill="#6e4040" />
        <circle cx="396" cy="180" r="18" fill="#4ea256" />
        <circle cx="408" cy="190" r="12" fill="#3f8f4a" />
      </g>

      {/* The hole: orange rails, the green, a sheen, and the tee mat. */}
      <path d={FAIRWAY} fill="none" stroke="#e8875a" strokeWidth="52" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke="#6fdc93" strokeWidth="40" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke="#a8f5c0" strokeOpacity="0.45" strokeWidth="8" strokeLinecap="round" transform="translate(0 -8)" />
      <rect x="166" y="268" width="24" height="14" rx="4" fill="#4fb873" transform="rotate(22 178 276)" />

      {/* Flowers. */}
      <g>
        {[
          [90, 262, "#ffd1e0"],
          [160, 300, "#fff3a8"],
          [300, 300, "#ffd1e0"],
          [350, 210, "#c9b8ff"],
          [440, 290, "#fff3a8"],
          [520, 252, "#ffd1e0"],
          [70, 240, "#c9b8ff"],
        ].map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill={c as string} className="animate-twinkle" style={{ animationDelay: `${i * 0.4}s`, animationDuration: "3s" }} />
        ))}
      </g>

      {/* Cup and flag. */}
      <ellipse cx={CUP.x} cy={CUP.y} rx="10" ry="4.5" fill="#14231b" />
      <line x1={CUP.x} y1={CUP.y} x2={CUP.x} y2={CUP.y - 74} stroke="#f6f3ea" strokeWidth="3" strokeLinecap="round" />
      <path d={`M${CUP.x + 1} ${CUP.y - 74} L ${CUP.x + 36} ${CUP.y - 63} L ${CUP.x + 1} ${CUP.y - 52} Z`} fill="#ef5a4f" className="animate-flag" style={box("left")} />

      {/* The putt, on a loop. */}
      {MOTION ? (
        <>
          {/* Pulled back to aim, then let go. */}
          <line x1="178" y1="276" x2="140" y2="262" stroke="#fff" strokeWidth="3" strokeDasharray="4 6" strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" values="0;0.9;0.9;0;0" keyTimes="0;0.1;0.26;0.28;1" dur={`${LOOP}s`} repeatCount="indefinite" />
          </line>
          <ellipse rx="8" ry="3" fill="#14231b" opacity="0.25">
            <animateMotion dur={`${LOOP}s`} repeatCount="indefinite" path={FAIRWAY} keyPoints="0;0;1;1" keyTimes="0;0.28;0.76;1" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.35 1;0 0 1 1" />
          </ellipse>
          <circle r="7" fill="#fff" stroke="#14231b" strokeOpacity="0.15" opacity="0">
            <animateMotion dur={`${LOOP}s`} repeatCount="indefinite" path={FAIRWAY} keyPoints="0;0;1;1" keyTimes="0;0.28;0.76;1" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.35 1;0 0 1 1" />
            <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;0.76;0.79;1" dur={`${LOOP}s`} repeatCount="indefinite" />
          </circle>
          {/* In! A ring of light from the cup and a cheer above it. */}
          <circle cx={CUP.x} cy={CUP.y} r="6" fill="none" stroke="#fbe3a8" strokeWidth="3" opacity="0">
            <animate attributeName="r" values="6;6;36;36" keyTimes="0;0.78;0.95;1" dur={`${LOOP}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.78;0.8;0.95;1" dur={`${LOOP}s`} repeatCount="indefinite" />
          </circle>
          <text x={CUP.x} y={CUP.y - 92} textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="700" fontSize="22" fill="#fbe3a8" opacity="0">
            Hole in one!
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.79;0.83;0.95;1" dur={`${LOOP}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 10;0 10;0 0;0 -6" keyTimes="0;0.79;0.85;1" dur={`${LOOP}s`} repeatCount="indefinite" />
          </text>
        </>
      ) : (
        <circle cx="178" cy="276" r="7" fill="#fff" />
      )}
    </svg>
  );
}

export type IsleTheme = "meadow" | "grove" | "dunes" | "glacier" | "storm";

interface Palette {
  top: string;
  side: string;
  rock: [string, string];
  /** The glow behind the island's card. */
  glow: string;
}

export const ISLE_PALETTES: Record<IsleTheme, Palette> = {
  meadow: { top: "#9ddf78", side: "#4f9a48", rock: ["#a8714a", "#4a2c3a"], glow: "rgb(157 223 120 / 0.28)" },
  grove: { top: "#5fb860", side: "#2f7a40", rock: ["#7a5238", "#2e2232"], glow: "rgb(95 184 96 / 0.28)" },
  dunes: { top: "#f0cd85", side: "#c99a52", rock: ["#c47f4a", "#5a2e2a"], glow: "rgb(240 205 133 / 0.28)" },
  glacier: { top: "#e8f7ff", side: "#9fd2ee", rock: ["#7fb3d6", "#2c3a66"], glow: "rgb(160 215 245 / 0.3)" },
  storm: { top: "#58705e", side: "#334a3c", rock: ["#4c4660", "#1a1628"], glow: "rgb(170 150 255 / 0.3)" },
};

/** A small island for one stage of the round, dressed for it. */
export function MiniIsland({ theme, className = "", style }: { theme: IsleTheme; className?: string; style?: CSSProperties }) {
  const p = ISLE_PALETTES[theme];
  const id = `pi-mini-${theme}`;
  return (
    <svg viewBox="0 0 200 190" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.rock[0]} />
          <stop offset="1" stopColor={p.rock[1]} />
        </linearGradient>
      </defs>

      {theme === "storm" && (
        <g>
          <g fill="none" stroke="#b9c4ff" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round">
            {[60, 80, 100, 120, 140].map((x, i) => (
              <line key={x} x1={x} y1="30" x2={x - 6} y2="58" strokeDasharray="5 7" className="animate-waterfall" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </g>
          <polyline points="112,24 102,44 112,44 98,66" fill="none" stroke="#fff6b0" strokeWidth="3" strokeLinejoin="round" className="animate-flash" />
          <g fill="#3a3550">
            <circle cx="80" cy="20" r="14" />
            <circle cx="104" cy="14" r="17" />
            <circle cx="128" cy="22" r="12" />
            <rect x="66" y="20" width="76" height="12" rx="6" />
          </g>
        </g>
      )}

      {/* Rock, grass side, grass top. */}
      <path d="M14 82 C 30 120, 70 128, 100 184 C 130 128, 170 120, 186 82 Z" fill={`url(#${id})`} />
      {theme === "glacier" && (
        <g fill="#dff4ff" opacity="0.85">
          <path d="M50 108 l6 0 l-3 22 z" />
          <path d="M140 110 l6 0 l-3 18 z" />
          <path d="M96 130 l6 0 l-3 26 z" />
        </g>
      )}
      <ellipse cx="100" cy="86" rx="87" ry="22" fill={p.side} />
      <ellipse cx="100" cy="80" rx="88" ry="22" fill={p.top} />

      {/* The hole across it. */}
      <path d="M48 86 C 80 96, 118 70, 150 80" fill="none" stroke="#e8875a" strokeWidth="18" strokeLinecap="round" />
      <path d="M48 86 C 80 96, 118 70, 150 80" fill="none" stroke={theme === "glacier" ? "#9fe6ff" : "#6fdc93"} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="150" cy="80" rx="4" ry="2" fill="#14231b" />
      <line x1="150" y1="80" x2="150" y2="54" stroke="#f6f3ea" strokeWidth="1.6" />
      <path d="M150.5 54 L 164 58.5 L 150.5 63 Z" fill="#ef5a4f" className="animate-flag" style={box("left")} />
      <circle cx="52" cy="86" r="3" fill="#fff" />

      {theme === "meadow" && (
        <g>
          {[
            [30, 78, "#ffd1e0"],
            [70, 72, "#fff3a8"],
            [110, 94, "#c9b8ff"],
            [176, 82, "#ffd1e0"],
            [124, 66, "#fff3a8"],
          ].map(([x, y, c], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill={c as string} />
          ))}
          <circle cx="92" cy="64" r="8" fill="#6fbf5c" />
          <circle cx="100" cy="66" r="6" fill="#7fcf6a" />
        </g>
      )}
      {theme === "grove" && (
        <g>
          {[
            [36, 60, 12],
            [86, 52, 15],
            [120, 56, 11],
          ].map(([x, y, r]) => (
            <g key={x} className="animate-sway-soft" style={{ ...box("bottom"), animationDelay: `${-x / 30}s` }}>
              <rect x={x - 2} y={y + r - 4} width="4" height="14" fill="#5a3a30" />
              <circle cx={x} cy={y} r={r} fill="#2f7a48" />
            </g>
          ))}
          <path d="M172 76 L 182 52 L 162 52 Z" fill="#245f3a" transform="rotate(180 172 64)" />
        </g>
      )}
      {theme === "dunes" && (
        <g>
          {/* A cactus and a little sandcastle. */}
          <g fill="#5d9c55">
            <rect x="34" y="52" width="7" height="26" rx="3.5" />
            <rect x="26" y="60" width="5" height="12" rx="2.5" />
            <rect x="44" y="56" width="5" height="12" rx="2.5" />
          </g>
          <g fill="#d9a65e">
            <rect x="96" y="56" width="26" height="18" />
            <rect x="94" y="50" width="6" height="8" />
            <rect x="105" y="50" width="6" height="8" />
            <rect x="116" y="50" width="6" height="8" />
            <rect x="105" y="64" width="7" height="10" rx="3.5" fill="#8a5a32" />
          </g>
        </g>
      )}
      {theme === "glacier" && (
        <g fill="#bfe6ff" stroke="#fff" strokeWidth="1">
          <path d="M30 80 L 40 50 L 50 80 Z" />
          <path d="M44 80 L 52 60 L 60 80 Z" />
          <path d="M162 84 L 172 56 L 182 84 Z" />
          <path d="M102 70 L 108 54 L 114 70 Z" />
        </g>
      )}
    </svg>
  );
}
