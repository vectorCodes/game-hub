import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { games } from "../../games/registry";
import { clamp, easeOutCubic, lerp, msToNextDaily, onFrame, range, setStyle, splitClock, trackPin } from "./scroll";

/**
 * The hero: a sunrise over paper. Six drawn layers, stacked and pinned; one scroll range
 * moves each at its own rate:
 *
 *   0.00 – 0.18  a haze of gold dust drifts off the page
 *   0.04 – 0.50  the sun climbs out from behind the hills, and the four games' objects
 *                cast shadows that shorten as it rises
 *   0.08 – 0.52  GAMEHUB resolves over the sun, then yields
 *   0.28 – 0.58  a paper matte closes in around the view: it becomes a printed plate
 *   0.70 – 1.00  everything slides away upward and the ground swallows the frame to
 *                paper, which is where the page continues
 *
 * A thin HUD rides on top: the real countdown to the next daily, the sun's elevation.
 */

const STAGE_VH = 420;
/** Where the horizon sits, as a share of the stage's height. */
const HORIZON = 62;
/** Centred, straight up from the vanishing point. */
const SUN_X = 50;
/** The sun's elevation once it has fully risen, for the HUD. */
const MAX_ELEV = 24;
const TITLE = "GameHub";
/** Extra space between the title's letters before it resolves, in em. */
const TITLE_SPREAD = 0.36;

type LayerName = "sky" | "sun" | "plain" | "frame" | "props" | "ground";

/** One object per game, standing on the floor. Shapes in local units, base along the bottom. */
const PROPS: { x: number; w: number; h: number; shape: ReactNode; eyes?: ReactNode }[] = [
  {
    // Shadow Guess: the chair from its cover.
    x: 15,
    w: 60,
    h: 100,
    shape: (
      <>
        <rect x="8" y="0" width="8" height="100" />
        <rect x="8" y="52" width="46" height="8" />
        <rect x="46" y="52" width="8" height="48" />
        <rect x="8" y="10" width="4" height="6" />
      </>
    ),
  },
  {
    // Sky Climb: a stepped tower with a flag on top.
    x: 36,
    w: 60,
    h: 110,
    shape: (
      <>
        <rect x="6" y="92" width="48" height="18" />
        <rect x="12" y="70" width="36" height="22" />
        <rect x="18" y="50" width="24" height="20" />
        <rect x="23" y="30" width="14" height="20" />
        <rect x="29" y="6" width="2" height="24" />
        <polygon points="31,6 46,11 31,16" />
      </>
    ),
  },
  {
    // Pair Pop: two tiles leaning on each other.
    x: 64,
    w: 76,
    h: 90,
    shape: (
      <>
        <rect x="6" y="28" width="32" height="62" rx="4" transform="rotate(-9 22 90)" />
        <rect x="38" y="28" width="32" height="62" rx="4" transform="rotate(9 54 90)" />
      </>
    ),
  },
  {
    // Prop Hunt: a toaster, with somebody inside.
    x: 85,
    w: 80,
    h: 84,
    shape: (
      <>
        <rect x="18" y="14" width="16" height="22" rx="3" />
        <rect x="44" y="14" width="16" height="22" rx="3" />
        <rect x="4" y="30" width="70" height="54" rx="10" />
        <rect x="72" y="44" width="8" height="6" />
      </>
    ),
    eyes: (
      <g fill="#f3ead9">
        <circle cx="30" cy="58" r="3.4" />
        <circle cx="48" cy="58" r="3.4" />
      </g>
    ),
  },
];

type Mote = { x: number; y: number; r: number; s: number; a: number };

export function Sunrise({ reduced }: { reduced: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<Partial<Record<LayerName, HTMLDivElement>>>({});
  const shadowRefs = useRef<HTMLDivElement[]>([]);
  const veilRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const elevRef = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<HTMLSpanElement[]>([]);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Dust canvas size, cached here: reading clientWidth per frame would force a layout.
  const dustSize = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const c = dustRef.current!;
    const sync = () => {
      // 1.5× is as sharp as specks this small need, at half the pixels of 2×.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      dustSize.current = { w: c.clientWidth, h: c.clientHeight };
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = dustRef.current!;
    const ctx = canvas.getContext("2d")!;
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const motes: Mote[] = Array.from({ length: 140 }, () => ({ x: rand(), y: rand(), r: 0.4 + rand() * 1.6, s: 0.3 + rand(), a: 0.2 + rand() * 0.6 }));
    let lastP = -1;
    let lastTime = 0;
    let lastClock = "";
    let lastElev = "";
    let dustCleared = false;
    let live: boolean | null = null;
    const pin = trackPin(rootRef.current!);

    // Transform and opacity only: the compositor moves the layers without repainting them.
    const set = (name: LayerName, y: number, scale = 1, opacity = 1) => {
      const el = layerRefs.current[name];
      if (!el) return;
      setStyle(el, "transform", `translate3d(0, ${y.toFixed(3)}vh, 0) scale(${scale.toFixed(4)})`);
      setStyle(el, "opacity", opacity.toFixed(3));
      setStyle(el, "visibility", opacity < 0.001 ? "hidden" : "");
    };

    const off = onFrame((f) => {
      const dt = lastTime ? Math.min(0.1, (f.time - lastTime) / 1000) : 1 / 60;
      lastTime = f.time;
      const { p, onscreen } = pin.at(f);
      if (onscreen !== live) {
        live = onscreen;
        rootRef.current!.toggleAttribute("data-paused", !onscreen);
      }
      if (!onscreen) return;

      // The countdown is real time, so it ticks whether or not the page scrolls.
      const { h, m, s } = splitClock(msToNextDaily());
      const clock = `T− ${h}:${m}:${s}`;
      if (clock !== lastClock) clockRef.current!.textContent = lastClock = clock;

      // Dust drifts every frame while it's visible; once gone, the canvas is cleared once and left alone.
      const veil = 1 - range(p, 0, 0.18);
      const { w, h: hgt } = dustSize.current;
      if (veil > 0.001 && w > 0) {
        dustCleared = false;
        const dpr = canvas.width / w;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, hgt);
        ctx.fillStyle = "#b07a1c";
        for (const mote of motes) {
          if (!reducedRef.current) {
            mote.x += 0.006 * mote.s * dt;
            mote.y -= 0.004 * mote.s * dt;
            if (mote.x > 1) mote.x -= 1;
            if (mote.y < 0) mote.y += 1;
          }
          ctx.globalAlpha = mote.a * veil;
          ctx.beginPath();
          ctx.arc(mote.x * w, (mote.y - p * 0.6) * hgt, mote.r * (1 + p * 4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (!dustCleared) {
        dustCleared = true;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const exit = range(p, 0.7, 1);
      const settle = easeOutCubic(range(p, 0, 0.5));

      // Haze clears upward.
      const veilEl = veilRef.current!;
      setStyle(veilEl, "opacity", veil.toFixed(3));
      setStyle(veilEl, "visibility", veil < 0.001 ? "hidden" : "");
      veilEl.toggleAttribute("data-paused", veil < 0.001);
      setStyle(veilEl, "transform", `translate3d(0, ${(-range(p, 0, 0.18) * 24).toFixed(3)}vh, 0) scale(${(1 + range(p, 0, 0.18) * 0.25).toFixed(4)})`);
      setStyle(canvas, "visibility", veil < 0.001 ? "hidden" : "");

      // Far → near, each faster than the one behind it.
      set("sky", lerp(0, -6, p), lerp(1.14, 1, settle));
      const rise = easeOutCubic(range(p, 0.04, 0.5));
      set("sun", lerp(16, -7, rise) - exit * 12, lerp(0.92, 1, rise));
      set("plain", lerp(9, 0, settle) - exit * 26);
      const rim = easeOutCubic(range(p, 0.28, 0.58));
      set("frame", -exit * 44, lerp(1.6, 1, rim), rim);
      const up = easeOutCubic(range(p, 0.2, 0.5));
      set("props", lerp(22, 0, up) - exit * 58, 1, clamp(up * 2));
      const ground = easeOutCubic(range(p, 0.3, 0.6));
      set("ground", lerp(30, 0, ground) - exit * 78);

      // Shadows fall away from the sun, toward us, and shorten as it climbs.
      const length = lerp(1.4, 0.4, rise);
      const strength = range(rise, 0, 0.25) * 0.3;
      shadowRefs.current.forEach((el, i) => {
        const lean = clamp((SUN_X - PROPS[i].x) * 1.3, -62, 62) * (1 - rise * 0.3);
        setStyle(el, "transform", `scale(1, ${(-length * 0.6).toFixed(4)}) skewX(${lean.toFixed(2)}deg)`);
        setStyle(el, "opacity", strength.toFixed(3));
      });

      // Title: the letters close in from wide tracking, then yield to the plate. Each
      // letter slides on its own transform; animating letter-spacing or a blur instead
      // would re-lay-out and repaint the whole headline every frame.
      const tIn = easeOutCubic(range(p, 0.08, 0.24));
      const tOut = range(p, 0.42, 0.52);
      const title = titleRef.current!;
      const shown = tIn * (1 - tOut);
      setStyle(title, "opacity", shown.toFixed(3));
      setStyle(title, "visibility", shown < 0.02 ? "hidden" : "");
      setStyle(title, "transform", `translate3d(0, ${(-p * 6).toFixed(3)}vh, 0)`);
      const spread = lerp(TITLE_SPREAD, 0, tIn);
      letterRefs.current.forEach((el, i) => {
        setStyle(el, "transform", `translate3d(${((i - (TITLE.length - 1) / 2) * spread).toFixed(4)}em, 0, 0)`);
      });

      // HUD.
      const hud = range(p, 0.02, 0.1) * (1 - range(p, 0.62, 0.72));
      setStyle(hudRef.current!, "opacity", hud.toFixed(3));
      setStyle(hudRef.current!, "visibility", hud < 0.001 ? "hidden" : "");
      hudRef.current!.toggleAttribute("data-paused", hud < 0.001);
      const elev = `${(rise * MAX_ELEV).toFixed(1)}°`;
      if (elev !== lastElev) elevRef.current!.textContent = lastElev = elev;
    });
    return () => {
      off();
      pin.release();
    };
  }, []);

  const layerRef = (name: LayerName) => (el: HTMLDivElement | null) => {
    if (el) layerRefs.current[name] = el;
  };
  const LAYER = "pointer-events-none absolute inset-0 will-change-transform";
  const [first] = games;

  return (
    <section ref={rootRef} aria-label="GameHub" className="relative" style={{ height: `${STAGE_VH}svh` }}>
      <div className="sticky top-0 h-svh overflow-hidden bg-paper">
        {/* Sky: paper, warming toward the sun. */}
        <div ref={layerRef("sky")} aria-hidden className={LAYER}>
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(70% 60% at ${SUN_X}% ${HORIZON}%, rgb(232 196 120 / 0.55), transparent 70%), #f3ead9` }}
          />
        </div>

        {/* Sun: the logo's red sun, centred on the horizon until it rises. */}
        <div ref={layerRef("sun")} aria-hidden className={LAYER}>
          <div className="absolute size-[clamp(7rem,22vmin,15rem)] -translate-x-1/2 -translate-y-1/2" style={{ left: `${SUN_X}%`, top: `${HORIZON}%` }}>
            <div className="absolute -inset-1/2 rounded-full bg-[radial-gradient(circle,rgb(217_88_44/0.22),transparent_65%)]" />
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_40%_35%,#e8774f,#d9582c_70%)]" />
          </div>
        </div>

        {/* Plain: two ridges of hills on the horizon, then the floor running toward us. */}
        <div ref={layerRef("plain")} aria-hidden className={LAYER}>
          <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="absolute inset-x-0 h-[9vh] w-full" style={{ top: `calc(${HORIZON}% - 9vh + 1px)` }}>
            <path d="M0 60 L0 30 C 90 18, 170 10, 260 22 S 420 40, 520 26 S 700 6, 800 20 S 940 36, 1000 24 L1000 60 Z" fill="#e6d7ba" />
            <path d="M0 60 L0 44 C 80 36, 150 30, 240 38 S 400 52, 480 42 S 640 26, 740 36 S 900 50, 1000 40 L1000 60 Z" fill="#dccaa9" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(#e3d3b5,#efe3cc_60%)]" style={{ top: `${HORIZON}%` }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {Array.from({ length: 17 }, (_, i) => (
                <line key={i} x1={SUN_X} y1="0" x2={-150 + i * 25} y2="100" stroke="#2a2216" strokeOpacity="0.07" vectorEffect="non-scaling-stroke" />
              ))}
              {[6, 16, 32, 56, 88].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#2a2216" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
        </div>

        {/* Title over the sun. */}
        <div
          ref={titleRef}
          className="pointer-events-none absolute inset-x-0 top-[18%] px-4 text-center will-change-[transform,opacity] md:top-[15%]"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <h1 aria-label={TITLE} className="font-display text-[clamp(2.5rem,9vw,8.5rem)] leading-none text-stone-100 text-legible" style={{ letterSpacing: "0.24em", marginRight: "-0.24em" }}>
            {[...TITLE].map((ch, i) => (
              <span
                key={i}
                aria-hidden
                ref={(el) => {
                  if (el) letterRefs.current[i] = el;
                }}
                className="inline-block will-change-transform"
              >
                {ch}
              </span>
            ))}
          </h1>
          <p className="mt-4 label-mono text-stone-300">Tiny games · Daily wins</p>
          <Link to={first.path} className="pointer-events-auto btn btn-primary mt-6">
            Play {first.title}
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* A paper matte closes in: the view becomes a printed plate. */}
        <div ref={layerRef("frame")} aria-hidden className={LAYER} style={{ opacity: 0 }}>
          <div className="absolute inset-0 shadow-[inset_0_0_0_3vw_#ece0c9]" />
          <div className="absolute inset-[3vw] ring-1 ring-ink/20" />
        </div>

        {/* The four games' objects, and their shadows on the floor. */}
        <div ref={layerRef("props")} aria-hidden className={LAYER} style={{ opacity: 0 }}>
          {PROPS.map((prop, i) => (
            <div
              key={prop.x}
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${prop.x}%`, top: "74%", height: `clamp(${(4.5 * prop.h) / 100}rem, ${(10 * prop.h) / 100}vw, ${(9 * prop.h) / 100}rem)`, aspectRatio: `${prop.w} / ${prop.h}` }}
            >
              <div
                ref={(el) => {
                  if (el) shadowRefs.current[i] = el;
                }}
                className="absolute inset-0 origin-bottom text-ink will-change-transform"
                style={{ opacity: 0 }}
              >
                <svg viewBox={`0 0 ${prop.w} ${prop.h}`} className="size-full" fill="currentColor">
                  {prop.shape}
                </svg>
              </div>
              <svg viewBox={`0 0 ${prop.w} ${prop.h}`} className="relative size-full text-ink" fill="currentColor">
                {prop.shape}
                {prop.eyes}
              </svg>
            </div>
          ))}
        </div>

        {/* Ground: the plate's ruled foot, one label per object. It carries a paper apron
            below it, so when it climbs it fills the screen and hands over to the page. */}
        <div ref={layerRef("ground")} className={LAYER}>
          <div className="absolute inset-x-0 top-[86%] h-[14%] border-t border-ink/25 bg-paper bg-[repeating-linear-gradient(90deg,rgb(42_34_22/0.25)_0_1px,transparent_1px_24px)] bg-[length:100%_6px] bg-no-repeat">
            {PROPS.map((prop, i) => (
              <span key={prop.x} className="absolute top-4 -translate-x-1/2 text-center label-mono whitespace-nowrap text-stone-400 max-sm:text-[9px]" style={{ left: `${prop.x}%` }}>
                <span className="text-ember-500">0{i + 1}</span>
                <span className="max-sm:hidden"> {games[i]?.title}</span>
              </span>
            ))}
          </div>
          <div className="absolute inset-x-0 top-full h-[110vh] bg-paper" />
        </div>

        {/* Gold dust on the page. */}
        <div
          ref={veilRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 will-change-[transform,opacity]"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 40%, rgb(232 196 120 / 0.55), transparent 70%), radial-gradient(50% 60% at 75% 60%, rgb(204 146 47 / 0.3), transparent 70%), radial-gradient(80% 80% at 50% 50%, rgb(236 224 201 / 0.92), rgb(243 234 217 / 0.98))",
          }}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center">
            <p className="label-mono text-stone-400">A hub of daily browser games</p>
            <p className="mt-3 font-display text-[0.8125rem] tracking-[0.5em] text-stone-100 uppercase" style={{ marginRight: "-0.5em" }}>
              Scroll to let the light in
            </p>
            <span className="mt-6 inline-block animate-bounce text-stone-400 motion-reduce:animate-none">↓</span>
          </div>
        </div>
        <canvas ref={dustRef} aria-hidden className="pointer-events-none absolute inset-0 size-full will-change-[opacity]" />

        {/* HUD. */}
        <div
          ref={hudRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-20 bottom-4 font-mono will-change-[opacity] text-[0.625rem] tracking-[0.14em] text-stone-300 uppercase sm:inset-x-6 sm:bottom-6 md:text-[0.6875rem]"
          style={{ opacity: 0 }}
        >
          <div className="brackets absolute inset-0 text-ink/35" />
          <div className="absolute top-3 left-3 space-y-1 md:top-4 md:left-4">
            <p ref={clockRef} className="tabular-nums">
              T− 00:00:00
            </p>
            <p className="text-stone-500">Next daily · 00:00 UTC</p>
          </div>
          <div className="absolute top-3 right-3 space-y-1 text-right md:top-4 md:right-4">
            <p>
              Sun elev{" "}
              <span ref={elevRef} className="text-ember-500 tabular-nums">
                0.0°
              </span>
            </p>
            <p className="text-stone-500">Above horizon</p>
          </div>
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4">
            {games.length} games live<span className="max-sm:hidden"> · Free · No sign-up</span>
          </div>
          <div className="absolute right-3 bottom-3 flex items-center gap-2 md:right-4 md:bottom-4">
            Scroll <span className="inline-block animate-bounce motion-reduce:animate-none">↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
