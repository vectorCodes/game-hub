// The Putt Isles landing's sky: stars, an aurora, drifting clouds, birds and glowing motes,
// layered so they shift at different depths as the pointer moves.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { makeRng } from "@shadow/shared";

/** SMIL animations (inside SVGs) ignore the CSS reduced-motion rule, so they check this. */
export const MOTION = typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Sets --mx/--my (-1…1, from the pointer's position on screen) on the element for <Layer>s. */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!MOTION) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return ref;
}

/** A full-size layer that moves `depth` px against the pointer: deeper layers move less. */
export function Layer({ depth, className = "", children }: { depth: number; className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-[translate] duration-700 ease-out ${className}`}
      style={{ translate: `calc(var(--mx, 0) * ${-depth}px) calc(var(--my, 0) * ${-depth * 0.6}px)` }}
    >
      {children}
    </div>
  );
}

const starRng = makeRng("putt-isles:stars");
const STARS = Array.from({ length: 70 }, () => ({
  x: starRng() * 100,
  y: starRng() * 55,
  size: 1 + starRng() * 2.2,
  delay: starRng() * 4,
  duration: 2 + starRng() * 3,
}));

export function Stars() {
  return (
    <>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute animate-twinkle rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.8)]"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
        />
      ))}
      <span className="absolute top-[12%] right-[12%] h-px w-28 animate-shooting bg-gradient-to-l from-white to-transparent" />
      <span className="absolute top-[6%] right-[40%] h-px w-20 animate-shooting bg-gradient-to-l from-white to-transparent [animation-delay:4.5s]" />
    </>
  );
}

/** Soft ribbons of light high in the sky. */
export function Aurora() {
  return (
    <>
      <div className="absolute -top-[10%] left-[5%] h-[45%] w-[70%] animate-aurora rounded-[50%] bg-[radial-gradient(closest-side,rgb(120_240_200/0.35),transparent)] blur-3xl" />
      <div className="absolute top-[0%] right-[-5%] h-[40%] w-[55%] animate-aurora rounded-[50%] bg-[radial-gradient(closest-side,rgb(190_140_255/0.32),transparent)] blur-3xl [animation-delay:-7s]" />
      <div className="absolute top-[30%] left-[30%] h-[40%] w-[50%] animate-aurora rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_170_140/0.25),transparent)] blur-3xl [animation-delay:-12s]" />
    </>
  );
}

/** A ringed planet hanging over the islands. */
export function Planet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className}>
      <defs>
        <radialGradient id="pi-planet" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffe6c4" />
          <stop offset="0.55" stopColor="#f2a08a" />
          <stop offset="1" stopColor="#7a4a8c" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="60" r="70" fill="#ffd6b0" opacity="0.12" />
      <ellipse cx="100" cy="64" rx="92" ry="16" fill="none" stroke="#ffe3c8" strokeOpacity="0.35" strokeWidth="5" />
      <circle cx="100" cy="60" r="38" fill="url(#pi-planet)" />
      {/* The ring's front half passes over the planet. */}
      <path d="M8 64 A92 16 0 0 0 192 64" fill="none" stroke="#ffe3c8" strokeOpacity="0.7" strokeWidth="5" />
    </svg>
  );
}

/** One puffy cloud. */
function Cloud({ width, tint, style }: { width: number; tint: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 80" width={width} className="shrink-0" style={style}>
      <g fill={tint}>
        <circle cx="50" cy="50" r="28" />
        <circle cx="90" cy="34" r="34" />
        <circle cx="135" cy="44" r="28" />
        <circle cx="165" cy="56" r="20" />
        <rect x="25" y="50" width="155" height="30" rx="15" />
      </g>
    </svg>
  );
}

const cloudRng = makeRng("putt-isles:clouds");
const CLOUD_ROW = Array.from({ length: 9 }, () => ({ width: 180 + cloudRng() * 220, lift: cloudRng() * 30, gap: -40 + cloudRng() * 30 }));

/** A row of clouds drifting sideways forever. `duration` sets the speed. */
export function CloudSea({ tint, duration = 90, className = "", reverse = false }: { tint: string; duration?: number; className?: string; reverse?: boolean }) {
  const strip = CLOUD_ROW.map((c, i) => <Cloud key={i} width={c.width} tint={tint} style={{ marginTop: c.lift, marginLeft: c.gap }} />);
  return (
    <div className={`absolute inset-x-0 overflow-hidden ${className}`}>
      <div className="flex w-max animate-cloud-scroll items-end" style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}>
        {strip}
        {strip}
      </div>
    </div>
  );
}

const moteRng = makeRng("putt-isles:motes");
const MOTES = Array.from({ length: 16 }, () => ({
  x: moteRng() * 100,
  y: 60 + moteRng() * 35,
  dx: -60 + moteRng() * 120,
  delay: moteRng() * 9,
  size: 3 + moteRng() * 4,
}));

/** Little lights rising out of the cloud sea. */
export function Motes() {
  return (
    <>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="absolute animate-mote rounded-full bg-lamp-200 shadow-[0_0_12px_4px_rgb(248_207_114/0.55)]"
          style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s`, "--dx": `${m.dx}px` } as CSSProperties}
        />
      ))}
    </>
  );
}

function Bird({ scale = 1 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 30 12" width={30 * scale} className="animate-flap" style={{ transformOrigin: "center" }}>
      <path d="M1 2 Q8 10 15 8 Q22 10 29 2" fill="none" stroke="#1c1633" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** A small flock gliding across now and then. */
export function Birds() {
  return (
    <div className="absolute top-[22%] left-0 animate-glide">
      <div className="flex items-start gap-3 opacity-70">
        <Bird />
        <div className="mt-4">
          <Bird scale={0.75} />
        </div>
        <div className="-mt-2">
          <Bird scale={0.6} />
        </div>
      </div>
    </div>
  );
}
