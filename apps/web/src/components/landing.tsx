// The game landing pages' shared parts: the hero (title, pitch and actions beside a framed
// screen onto the game), section heads, step and way cards, stat tiles and the closing call.
// Colours come from the page's accent (see [data-game] in index.css).
import type { ReactNode } from "react";
import { Link } from "react-router";
import { countUp, gsap, SplitText, useGsap } from "../lib/motion";
import { Reveal } from "./Reveal";

/** A rounded pill with a pulsing dot: "Daily #12 is live · 40 played". */
export function LivePill({ children }: { children: ReactNode }) {
  return (
    <p data-rise className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 label-mono text-accent-text ring-1 ring-accent/30">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping-soft rounded-full bg-accent" />
        <span className="relative h-2 w-2 rounded-full bg-accent" />
      </span>
      {children}
    </p>
  );
}

/** A dark chip laid over the screen's picture. */
function ScreenChip({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 label-mono text-white backdrop-blur-md">
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-400" />}
      {children}
    </span>
  );
}

/**
 * The hero: the title types in letter by letter, the rest rises after it, and the screen
 * comes up beside it, leaning toward the pointer and sinking back as you scroll on.
 *
 * `screen` is what the window shows (a live scene or a drawing), on `screenGround`; the
 * chips name it: `live` (top left, with a red dot), `corner` (top right), `caption` (bottom left).
 */
export function GameHero({
  pill,
  title,
  accent,
  lead,
  actions,
  meta,
  screen,
  screenGround,
  live,
  corner,
  caption,
}: {
  pill: ReactNode;
  title: string;
  accent: string;
  lead: ReactNode;
  actions: ReactNode;
  meta?: ReactNode;
  screen: ReactNode;
  screenGround: string;
  live?: ReactNode;
  corner?: ReactNode;
  caption?: ReactNode;
}) {
  const ref = useGsap<HTMLElement>((root, reduced) => {
    if (reduced) return;
    const split = SplitText.create(root.querySelector("[data-title]"), { type: "chars", mask: "chars" });
    gsap.from(split.chars, { yPercent: 115, rotate: 10, duration: 0.9, ease: "back.out(1.7)", stagger: 0.04 });
    gsap.from("[data-rise]", { y: 26, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, delay: 0.3 });
    gsap.from("[data-screen]", { y: 80, rotateX: 16, transformPerspective: 1400, autoAlpha: 0, duration: 1.3, ease: "expo.out", delay: 0.15 });
    gsap.to("[data-screen]", {
      scale: 0.94,
      yPercent: 6,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true },
    });
    const tilt = root.querySelector<HTMLElement>("[data-tilt]")!;
    const rx = gsap.quickTo(tilt, "rotationX", { duration: 0.9, ease: "power3" });
    const ry = gsap.quickTo(tilt, "rotationY", { duration: 0.9, ease: "power3" });
    const lean = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = root.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 9);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
    };
    root.addEventListener("pointermove", lean);
    return () => root.removeEventListener("pointermove", lean);
  });

  return (
    <section ref={ref} className="relative isolate">
      <div className="container-page grid min-h-[calc(100svh-4rem)] items-center gap-12 py-14 lg:grid-cols-12 lg:gap-8 lg:py-10">
        <div className="relative z-10 lg:col-span-6">
          {pill}
          <h1 data-title className="mt-6 text-display">
            {title} <span className="text-accent">{accent}</span>
          </h1>
          <div data-rise className="mt-6 max-w-md text-lead">
            {lead}
          </div>
          <div data-rise className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {actions}
          </div>
          {meta && (
            <div data-rise className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-400">
              {meta}
            </div>
          )}
        </div>

        <div data-screen className="relative lg:col-span-6 lg:-mr-12 xl:-mr-28" style={{ perspective: "1400px" }}>
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-glow/25 blur-3xl" />
          <div data-tilt className="relative aspect-[16/11] overflow-hidden rounded-[1.75rem] shadow-glow-lg ring-1 ring-white/15" style={{ background: screenGround }}>
            {screen}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.75rem] shadow-[inset_0_0_0_6px_rgb(0_0_0/0.25),inset_0_-80px_80px_-40px_rgb(0_0_0/0.35)]" />
            {(live || corner) && (
              <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                {live ? <ScreenChip live>{live}</ScreenChip> : <span />}
                {corner && <ScreenChip>{corner}</ScreenChip>}
              </div>
            )}
            {caption && (
              <div className="pointer-events-none absolute bottom-4 left-4">
                <ScreenChip>{caption}</ScreenChip>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Leaderboard →", the hero's quiet last link. */
export function MetaLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="underline decoration-stone-600 underline-offset-4 transition-colors hover:text-stone-50">
      {children}
    </Link>
  );
}

/** A section's kicker and title, and an optional lead under them. */
export function SectionHead({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-section">{title}</h2>
      {children && <p className="mt-5 text-lead">{children}</p>}
    </Reveal>
  );
}

/** A keyboard key, standing on its edge. */
export function Kbd({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`grid h-11 place-items-center rounded-lg bg-stone-100 font-mono text-xs font-semibold text-stone-950 shadow-[0_4px_0_var(--n-500)] ${wide ? "px-5" : "w-11"}`}
    >
      {children}
    </kbd>
  );
}

export interface Step {
  title: string;
  body: ReactNode;
  /** Drawn above the title: keys, a meter, a big emoji. */
  visual?: ReactNode;
}

/** Numbered cards, one per step, rising in one after another. */
export function StepCards({ steps }: { steps: Step[] }) {
  const cols = steps.length === 4 ? "lg:grid-cols-4" : steps.length === 3 ? "lg:grid-cols-3" : "";
  return (
    <div className={`mt-10 grid gap-4 sm:grid-cols-2 ${cols}`}>
      {steps.map((s, i) => (
        <Reveal key={s.title} delay={i * 80} className="surface flex flex-col p-6">
          {s.visual && <div className="grid h-28 place-items-center">{s.visual}</div>}
          <div className={`flex items-baseline gap-3 ${s.visual ? "mt-6" : ""}`}>
            <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="font-display text-2xl font-bold tracking-tight">{s.title}</h3>
          </div>
          <p className="mt-2 text-stone-400">{s.body}</p>
        </Reveal>
      ))}
    </div>
  );
}

export interface Way {
  title: string;
  body: ReactNode;
  to: string;
  cta: string;
  onClick?: () => void;
}

/** The ways to play, as cards that link straight in (plain cards where you can't play here). */
export function WayCards({ ways, playable = true }: { ways: Way[]; playable?: boolean }) {
  const cols = ways.length === 3 ? "lg:grid-cols-3" : ways.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2";
  return (
    <div className={`mt-10 grid gap-4 ${cols}`}>
      {ways.map((w, i) => {
        const body = (
          <>
            <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 font-display text-3xl font-bold tracking-tight">{w.title}</h3>
            <p className="mt-3 text-stone-400">{w.body}</p>
            {playable && (
              <span className="mt-auto inline-flex items-center gap-2 pt-8 font-display font-bold text-accent-text">
                {w.cta} <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            )}
          </>
        );
        return (
          <Reveal key={w.title} delay={i * 80}>
            {playable ? (
              <Link
                to={w.to}
                onClick={w.onClick}
                className="group surface flex h-full flex-col p-7 transition-[box-shadow,transform] duration-300 ease-mirai hover:-translate-y-1 hover:shadow-glow"
              >
                {body}
              </Link>
            ) : (
              <div className="surface flex h-full flex-col p-7">{body}</div>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}

/**
 * Big numbers in tiles; each counts up from 0 when it scrolls in. A value of null shows a
 * dash. `deps` re-runs the count when late numbers (the server's) arrive.
 */
export function StatTiles({ stats, stacked = false }: { stats: [label: string, value: number | null | undefined, unit?: string][]; stacked?: boolean }) {
  const ref = useGsap<HTMLDListElement>(
    (root, reduced) => {
      if (!reduced) countUp(root);
    },
    stats.map(([, v]) => v),
  );
  return (
    <dl ref={ref} className={`grid grid-cols-3 gap-3 ${stacked ? "lg:grid-cols-1" : ""}`}>
      {stats.map(([label, value, unit]) => (
        <div key={label} className={`rounded-xl bg-stone-950/50 p-4 ring-1 ring-white/8 ${stacked ? "lg:flex lg:items-baseline lg:justify-between lg:px-6" : ""}`}>
          <dt className="label-mono text-stone-500">{label}</dt>
          <dd className={`mt-2 font-display text-3xl font-extrabold tracking-tight tabular-nums sm:text-5xl ${stacked ? "lg:mt-0" : ""}`}>
            {value ? (
              <>
                <span data-count={value}>{value}</span>
                {unit && <span className="text-base font-semibold text-stone-500">{unit}</span>}
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A panel for today's challenge: a glow in the corner, the copy left, `aside` right. */
export function TodayPanel({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <Reveal className="surface relative overflow-hidden p-6 sm:p-10 lg:p-14">
      <div aria-hidden className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-end">
        <div>{children}</div>
        {aside}
      </div>
    </Reveal>
  );
}

/** The closing call: a slab of the accent with one line and one button. */
export function LastCall({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="container-page mt-24 sm:mt-32">
      <Reveal className="relative overflow-hidden rounded-[2rem] bg-accent px-6 py-14 text-center text-accent-ink sm:px-12 sm:py-20">
        <div aria-hidden className="absolute inset-0 opacity-15 [background:repeating-linear-gradient(-45deg,currentColor_0_2px,transparent_2px_18px)]" />
        <h2 className="relative font-display text-4xl font-extrabold tracking-tight sm:text-6xl">{title}</h2>
        {children && <p className="relative mx-auto mt-4 max-w-md opacity-85">{children}</p>}
        {action && <div className="relative mt-8">{action}</div>}
      </Reveal>
    </section>
  );
}

/** The button on the accent slab: dark, so it stands out from the slab's own colour. */
export const lastCallButton =
  "btn bg-stone-950 text-stone-50 shadow-[0_4px_0_rgb(0_0_0/0.35)] hover:shadow-[0_6px_0_rgb(0_0_0/0.35)] active:shadow-none";
