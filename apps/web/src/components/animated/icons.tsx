import { useId } from "react";

// Small looping illustrations for the landing page (Lottie-style, but plain SVG + CSS
// keyframes from index.css). Each sits in a 64×64 box; reduced motion freezes them.

const box = "h-full w-full overflow-visible";
const origin = (x: number, y: number) => ({ transformBox: "view-box" as const, transformOrigin: `${x}px ${y}px` });

/** A lit wall with a chair's shadow leaning as the light circles. */
export function ShadowIcon() {
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <rect x="6" y="8" width="52" height="46" rx="10" fill="#f1eeff" />
      <circle cx="32" cy="30" r="22" fill="#ffffff" className="animate-beam" />
      <g className="animate-sway" style={origin(30, 50)}>
        <path d="M23 16 h4 v34 h-4 z M23 33 h18 v4 h-18 z M37 33 h4 v17 h-4 z" fill="#1a1433" />
      </g>
      <circle cx="12" cy="14" r="2.5" fill="#f0abfc" className="animate-twinkle" style={origin(12, 14)} />
    </svg>
  );
}

/** A guess types into the field, then a miss marker pops. */
export function GuessIcon() {
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <rect x="4" y="20" width="56" height="24" rx="12" fill="#251f47" stroke="#5a5483" />
      <rect x="13" y="29" width="24" height="6" rx="3" fill="#e4e0f7" className="animate-type" style={origin(13, 32)} />
      <rect x="39" y="27" width="2" height="10" rx="1" fill="#ec4899" className="animate-caret" />
      <g className="animate-miss" style={origin(52, 14)}>
        <circle cx="52" cy="14" r="9" fill="#fb7185" />
        <path d="M48.5 10.5 l7 7 M55.5 10.5 l-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** A star with twinkling sparks: solving early scores more. */
export function PointsIcon() {
  const star = useId();
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <defs>
        <linearGradient id={star} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <g className="animate-drift" style={origin(32, 34)}>
        <path
          d="M32 12 l6.2 12.6 13.8 2 -10 9.8 2.4 13.8 -12.4 -6.5 -12.4 6.5 2.4 -13.8 -10 -9.8 13.8 -2 z"
          fill={`url(#${star})`}
          strokeLinejoin="round"
        />
      </g>
      <path d="M10 14 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 z" fill="#f0abfc" className="animate-twinkle" style={origin(12, 16)} />
      <path d="M52 46 l1.5 -4 1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 z" fill="#67e8f9" className="animate-twinkle" style={{ ...origin(53.5, 47.5), animationDelay: "-1.2s" }} />
    </svg>
  );
}

/** A flame that never goes out: the daily streak. */
export function FlameIcon() {
  const flame = useId();
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <defs>
        <linearGradient id={flame} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ec4899" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <g className="animate-flicker" style={origin(32, 54)}>
        <path d="M32 8 C40 20 50 26 48 40 C46 50 39 56 32 56 C25 56 18 50 16 41 C14 31 22 26 24 16 C28 22 30 24 32 8 Z" fill={`url(#${flame})`} />
        <path d="M32 30 C36 36 40 40 38 46 C37 50 34 52 32 52 C29 52 26 50 26 46 C26 41 30 38 32 30 Z" fill="#fde68a" />
      </g>
    </svg>
  );
}

/** Podium bars rising in turn: the leaderboard. */
export function PodiumIcon() {
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <rect x="8" y="30" width="14" height="24" rx="3" fill="#a5a0c8" className="animate-grow" style={{ ...origin(15, 54), animationDelay: "-0.3s" }} />
      <rect x="25" y="16" width="14" height="38" rx="3" fill="#8b5cf6" className="animate-grow" style={origin(32, 54)} />
      <rect x="42" y="36" width="14" height="18" rx="3" fill="#ec4899" className="animate-grow" style={{ ...origin(49, 54), animationDelay: "-0.6s" }} />
      <circle cx="32" cy="9" r="3" fill="#fbbf24" className="animate-twinkle" style={origin(32, 9)} />
    </svg>
  );
}

/** A clock whose hand sweeps round: about two minutes a day. */
export function ClockIcon() {
  return (
    <svg viewBox="0 0 64 64" className={box} aria-hidden="true">
      <circle cx="32" cy="34" r="22" fill="#251f47" stroke="#67e8f9" strokeWidth="3" />
      <rect x="29" y="6" width="6" height="6" rx="2" fill="#67e8f9" />
      <path d="M32 34 V20" stroke="#e4e0f7" strokeWidth="3" strokeLinecap="round" className="animate-tick" style={origin(32, 34)} />
      <circle cx="32" cy="34" r="3" fill="#ec4899" />
    </svg>
  );
}
