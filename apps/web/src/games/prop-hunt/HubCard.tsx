// Prop Hunt's tile on the GameHub page: a kitchen counter at night under a seeker's flashlight,
// one prop looking back. Drawn in SVG (no three.js, so the hub stays light).
import { HUNT_MAX_PLAYERS, HUNT_MIN_PLAYERS } from "@shadow/shared";
import { CoverFrame } from "../../components/CoverFrame";

/** Kitchen things in silhouette, standing on the counter top at y = 172. */
const COUNTER = 172;
const DARK = "#0c0810";
const RIM = "#ffd98a";

/**
 * Key art for the hide-and-seek: a kitchen counter at night, the seeker's flashlight
 * sweeping across it, and one toaster among the props that is very much looking back.
 */
export function PropHuntCover() {
  return (
    <CoverFrame label="A flashlight sweeps a dark kitchen counter; one toaster on it has eyes.">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="ph-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1024" />
            <stop offset="1" stopColor="#33213d" />
          </linearGradient>
          <linearGradient id="ph-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d1324" />
            <stop offset="1" stopColor="#09060c" />
          </linearGradient>
          <pattern id="ph-tiles" width="30" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 0.5 H30 M0.5 0 V8 M15.5 8 V16 M0 8.5 H30" stroke="#fff" strokeOpacity="0.045" fill="none" />
          </pattern>
          <linearGradient id="ph-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff2c4" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#ffd98a" stopOpacity="0.2" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="ph-spot">
            <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ffe7ad" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ph-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a4562" />
            <stop offset="1" stopColor="#140e18" />
          </linearGradient>
          <filter id="ph-haze" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Wall with its tiles, the counter top and the cupboards under it. */}
        <rect width="400" height={COUNTER} fill="url(#ph-wall)" />
        <rect width="400" height={COUNTER} fill="url(#ph-tiles)" />
        <rect y={COUNTER} width="400" height="88" fill="url(#ph-front)" />
        <rect y={COUNTER - 1} width="400" height="7" fill="#2e2135" />
        <rect y={COUNTER - 1} width="400" height="1" fill={RIM} fillOpacity="0.25" />
        <path d={`M132 ${COUNTER + 14} V260 M268 ${COUNTER + 14} V260`} stroke="#fff" strokeOpacity="0.05" />
        <rect x="118" y={COUNTER + 30} width="8" height="2" rx="1" fill="#fff" fillOpacity="0.12" />
        <rect x="274" y={COUNTER + 30} width="8" height="2" rx="1" fill="#fff" fillOpacity="0.12" />

        {/* The props, a little larger than life, rim-lit from the window. */}
        <g transform={`translate(200 ${COUNTER}) scale(1.22) translate(-200 ${-COUNTER})`}>
          {/* The kettle. */}
          <g fill="url(#ph-body)">
            <path d={`M58 ${COUNTER} Q52 ${COUNTER - 44} 82 ${COUNTER - 48} Q112 ${COUNTER - 44} 106 ${COUNTER} Z`} />
            <path d={`M60 ${COUNTER - 26} L40 ${COUNTER - 44} L44 ${COUNTER - 46} L64 ${COUNTER - 34} Z`} />
            <rect x="76" y={COUNTER - 54} width="12" height="7" rx="3" />
          </g>
          <path d={`M70 ${COUNTER - 48} Q82 ${COUNTER - 70} 96 ${COUNTER - 48}`} fill="none" stroke="#2a1e30" strokeWidth="4" />
          {/* Two mugs. */}
          <g fill="url(#ph-body)">
            <rect x="128" y={COUNTER - 30} width="24" height="30" rx="3" />
            <rect x="160" y={COUNTER - 26} width="22" height="26" rx="3" />
          </g>
          <path d={`M152 ${COUNTER - 23} q9 0 9 8 q0 8 -9 8`} fill="none" stroke="#2a1e30" strokeWidth="4" />
          {/* The jar and the plant at the far end. */}
          <rect x="318" y={COUNTER - 40} width="26" height="40" rx="5" fill="url(#ph-body)" />
          <rect x="316" y={COUNTER - 46} width="30" height="8" rx="2" fill="#2a1e30" />
          <path d={`M352 ${COUNTER} l4 -22 h20 l4 22 Z`} fill="url(#ph-body)" />
          <path d={`M366 ${COUNTER - 22} q-14 -18 -6 -38 q8 12 6 38 q4 -26 18 -32 q2 18 -18 32`} fill="#1b2a22" />

          {/* The toaster: one of the props, and not a toaster at all. */}
          <g>
            <rect x="212" y={COUNTER - 46} width="78" height="46" rx="12" fill="url(#ph-body)" />
            <rect x="226" y={COUNTER - 50} width="20" height="6" rx="3" fill={DARK} />
            <rect x="256" y={COUNTER - 50} width="20" height="6" rx="3" fill={DARK} />
            <rect x="290" y={COUNTER - 30} width="6" height="12" rx="2" fill="#2a1e30" />
            <rect x="216" y={COUNTER - 45} width="70" height="1.4" rx="0.7" fill={RIM} fillOpacity="0.6" />
            <rect x="218" y={COUNTER - 8} width="66" height="3" rx="1.5" fill={DARK} fillOpacity="0.5" />
            {/* Eyes, half-lidded, sliding toward the light. */}
            <ellipse cx="240" cy={COUNTER - 24} rx="7" ry="7.5" fill="#fff7e6" />
            <ellipse cx="262" cy={COUNTER - 24} rx="7" ry="7.5" fill="#fff7e6" />
            <circle cx="237" cy={COUNTER - 22} r="3.4" fill={DARK} />
            <circle cx="259" cy={COUNTER - 22} r="3.4" fill={DARK} />
            <path d={`M232 ${COUNTER - 25} Q240 ${COUNTER - 34} 248 ${COUNTER - 25} V${COUNTER - 33} H232 Z`} fill="#3a2a40" />
            <path d={`M254 ${COUNTER - 25} Q262 ${COUNTER - 34} 270 ${COUNTER - 25} V${COUNTER - 33} H254 Z`} fill="#3a2a40" />
          </g>

          <path d={`M60 ${COUNTER - 40} Q82 ${COUNTER - 50} 104 ${COUNTER - 40} M128 ${COUNTER - 29.5} H152 M160 ${COUNTER - 25.5} H182 M318 ${COUNTER - 45.5} H346`} fill="none" stroke={RIM} strokeOpacity="0.45" strokeWidth="1" />
        </g>

        {/* The flashlight, from the seeker just out of frame on the left. */}
        <g style={{ mixBlendMode: "screen" }} transform="translate(-30 56) rotate(16)">
          <g className="cover-sweep">
            <polygon points="0,-4 0,4 320,62 320,-62" fill="url(#ph-beam)" filter="url(#ph-haze)" />
            <ellipse cx="290" cy="0" rx="46" ry="64" fill="url(#ph-spot)" />
          </g>
        </g>
      </svg>
    </CoverFrame>
  );
}

export function PropHuntStatus() {
  return (
    <span>
      Rooms of {HUNT_MIN_PLAYERS}–{HUNT_MAX_PLAYERS} · <span className="text-stone-200">desktop only</span>
    </span>
  );
}
