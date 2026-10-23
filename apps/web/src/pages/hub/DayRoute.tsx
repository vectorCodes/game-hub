import { useEffect, useRef, useState } from "react";
import { clamp, easeOutCubic, onFrame, range, setStyle, trackPin } from "./scroll";

/**
 * One day on GameHub, drawn as you scroll. The section pins while the four legs of the
 * day ink themselves one after another, a marker riding the leg being drawn; the UTC
 * clock runs from 00:00 to 24:00 along the long arc from today's sun to tomorrow.
 */

const SECTION_VH = 380;
const WINDOW = [0.06, 0.92] as const;
const DAY_MINUTES = 24 * 60;

const SUN = { cx: 230, cy: 320, r: 92 };
const MOON = { cx: 985, cy: 300, r: 46 };

const LEGS = [
  // The new daily: a lap and a bit around the sun.
  `M${SUN.cx} ${SUN.cy - 128} a128 128 0 1 1 -0.1 0 a128 128 0 0 1 106 57`,
  // The day: the long arc across.
  `M${SUN.cx + 106} ${SUN.cy - 71} C 520 40, 820 70, ${MOON.cx - 20} ${MOON.cy - 84}`,
  // The evening: around the moon while the boards settle.
  `M${MOON.cx - 20} ${MOON.cy - 84} a86 86 0 1 1 -0.1 0.2 a86 86 0 0 1 20 1`,
  // Down into tomorrow.
  `M${MOON.cx} ${MOON.cy - 86} Q ${MOON.cx + 40} ${MOON.cy - 70} ${MOON.cx + 30} ${MOON.cy - 36}`,
];

const STOPS = [
  { time: "00:00 UTC", title: "A new daily", body: "Every game rolls a new challenge at midnight UTC. The same one for everyone, so every result compares." },
  { time: "Daytime", title: "Play in minutes", body: "A few minutes a game. Open a link and play: guests welcome, nothing to install." },
  { time: "Evening", title: "Compare and share", body: "Daily, weekly and all-time boards. Send your result, or a beat-my-climb link to a friend." },
  { time: "Tomorrow", title: "Keep the streak", body: "Sign in and your streak, stats and unlocks carry across every game, day after day." },
];

/** The pen: ink on paper, rice on night. */
const INK = "var(--n-100)";

export function DayRoute() {
  const rootRef = useRef<HTMLElement>(null);
  const legRefs = useRef<SVGPathElement[]>([]);
  const markerRef = useRef<SVGGElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const [leg, setLeg] = useState(0);

  useEffect(() => {
    const pin = trackPin(rootRef.current!);
    // Path lengths never change (the SVG scales, its user units don't), so measure them once.
    const lengths = legRefs.current.map((path) => path.getTotalLength());
    let lastP = -1;
    let current = 0;
    let lastClock = "";
    const off = onFrame((f) => {
      const { p, onscreen } = pin.at(f);
      if (!onscreen) return;
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const u = range(p, ...WINDOW) * LEGS.length;
      const s = clamp(Math.floor(u), 0, LEGS.length - 1);
      if (s !== current) {
        current = s;
        setLeg(s);
      }
      legRefs.current.forEach((path, i) => {
        const k = easeOutCubic(clamp(u - i));
        const dash = (1 - k).toFixed(4);
        if (path.style.strokeDashoffset !== dash) path.style.strokeDashoffset = dash;
        if (i === s) {
          const pt = path.getPointAtLength(lengths[i] * k);
          setStyle(markerRef.current!, "transform", `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px)`);
        }
      });
      const mins = Math.round(easeOutCubic(clamp(u - 1)) * DAY_MINUTES);
      const clock = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      if (clock !== lastClock) clockRef.current!.textContent = lastClock = clock;
    });
    return () => {
      off();
      pin.release();
    };
  }, []);

  const stop = STOPS[leg];

  return (
    <section ref={rootRef} id="day" aria-labelledby="day-title" className="relative" style={{ height: `${SECTION_VH}svh` }}>
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden px-5 pt-20 pb-8 sm:px-8 md:px-[6vw] md:pt-24">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">The daily loop</p>
            <h2 id="day-title" className="mt-3 max-w-[20ch] text-section">
              One day, one daily. Drawn as you scroll.
            </h2>
          </div>
          <p className="label-mono text-stone-400" aria-live="off">
            Clock{" "}
            <span ref={clockRef} className="text-stone-100 tabular-nums">
              00:00
            </span>{" "}
            UTC
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center">
          <svg viewBox="0 0 1200 600" className="h-auto max-h-full w-full" role="img" aria-label="A day on GameHub, drawn in four legs from today's sun to tomorrow.">
            <defs>
              <radialGradient id="day-sun" cx="40%" cy="35%" r="70%">
                <stop offset="0" stopColor="#e8774f" />
                <stop offset="1" stopColor="#d9582c" />
              </radialGradient>
              <radialGradient id="day-glow">
                <stop offset="0.75" stopColor="#cc922f" stopOpacity="0.3" />
                <stop offset="1" stopColor="#cc922f" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Faint printed dots. */}
            <g fill={INK}>
              {Array.from({ length: 70 }, (_, i) => (
                <circle key={i} cx={(i * 173) % 1200} cy={(i * 97) % 600} r={i % 7 === 0 ? 1.6 : 0.9} opacity={0.08 + ((i * 37) % 50) / 400} />
              ))}
            </g>

            <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r * 1.25} fill="url(#day-glow)" />
            <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill="url(#day-sun)" />
            {/* Tomorrow: the moon, in the pen's colour, with its craters in the ground's. */}
            <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill={INK} />
            <g fill="var(--n-800)" opacity="0.3">
              <circle cx={MOON.cx - 14} cy={MOON.cy - 10} r="7" />
              <circle cx={MOON.cx + 12} cy={MOON.cy + 14} r="5" />
              <circle cx={MOON.cx + 18} cy={MOON.cy - 18} r="3.5" />
            </g>

            {/* Ghost of the whole route, then the inked legs over it. */}
            {LEGS.map((d, i) => (
              <path key={`g${i}`} d={d} fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="3 6" />
            ))}
            {LEGS.map((d, i) => (
              <path
                key={i}
                ref={(el) => {
                  if (el) legRefs.current[i] = el;
                }}
                d={d}
                pathLength={1}
                fill="none"
                stroke={i === 1 ? "#cc922f" : INK}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset="1"
              />
            ))}

            <g ref={markerRef} style={{ transform: `translate(${SUN.cx}px, ${SUN.cy - 128}px)` }}>
              <circle r="11" fill="#d9582c" opacity="0.25" />
              <circle r="5" fill="#d9582c" />
            </g>

            <g fontFamily="Azeret Mono, monospace" fontSize="13" letterSpacing="2" fill="var(--n-500)">
              <text x={SUN.cx} y={SUN.cy + SUN.r + 58} textAnchor="middle">
                TODAY
              </text>
              <text x={MOON.cx} y={MOON.cy + MOON.r + 70} textAnchor="middle">
                TOMORROW
              </text>
            </g>
          </svg>
        </div>

        {/* Current stop. */}
        <div className="grid gap-4 border-t hairline pt-5 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-10">
          <p className="eyebrow">
            {stop.time} · Leg {leg + 1}/{STOPS.length}
          </p>
          <div key={leg} className="animate-rise" aria-live="polite">
            <h3 className="font-display text-xl font-bold tracking-tight md:text-3xl">{stop.title}</h3>
            <p className="mt-1.5 max-w-[40rem] text-stone-400">{stop.body}</p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {STOPS.map((_, i) => (
              <span key={i} className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= leg ? "bg-accent" : "bg-stone-100/15"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
