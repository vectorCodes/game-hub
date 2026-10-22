import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { games } from "../../games/registry";
import { clamp, onFrame, range, setStyle, trackPin } from "./scroll";

/**
 * The lineup, as a reel of covers. The section pins and the reel slides sideways with the
 * scroll; the cover nearest the focus line is in focus, the rest dim back.
 */

const SECTION_VH = 320;

export function Lineup() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const cardRefs = useRef<HTMLLIElement[]>([]);
  const barRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current!;
    // Layout positions, measured on resize only. offsetLeft ignores the track's slide, so
    // it is where the track sits at rest inside the pinned stage.
    let travel = 0;
    let centers: number[] = [];
    const pin = trackPin(rootRef.current!, (vw) => {
      travel = Math.max(0, track.offsetLeft + track.scrollWidth - vw * 0.94);
      // Card centres relative to the track: both rects carry the same slide, and each card
      // scales about its bottom centre, so neither moves the difference.
      const left = track.getBoundingClientRect().left;
      centers = cardRefs.current.map((card) => {
        const r = card.getBoundingClientRect();
        return track.offsetLeft + (r.left + r.right) / 2 - left;
      });
    });
    let lastP = -1;
    let lastW = 0;
    let lastCount = "";
    let live: boolean | null = null;
    const off = onFrame((f) => {
      const { p, onscreen } = pin.at(f);
      // The covers animate SVG groups, which the compositor can't take over: each frame of
      // them is a style recalc and a layout, whether or not they're on screen. Pause them
      // while the reel is out of view.
      if (onscreen !== live) {
        live = onscreen;
        track.toggleAttribute("data-paused", !onscreen);
      }
      if (!onscreen) return;
      if (Math.abs(p - lastP) < 0.00005 && f.vw === lastW) return;
      lastP = p;
      lastW = f.vw;

      const k = range(p, 0.04, 0.96);
      const shift = -k * travel;
      setStyle(track, "transform", `translate3d(${shift.toFixed(2)}px, 0, 0)`);

      // The focus line sits right of centre beside the heading, centred on phones.
      const focus = f.vw * (f.vw >= 768 ? 0.62 : 0.5);
      let nearest = 0;
      let best = Infinity;
      cardRefs.current.forEach((card, i) => {
        const off = (centers[i] + shift - focus) / f.vw;
        const a = clamp(Math.abs(off) * 1.6);
        setStyle(card, "opacity", (1 - a * 0.55).toFixed(3));
        setStyle(card, "transform", `scale(${(1 - a * 0.07).toFixed(4)})`);
        if (Math.abs(off) < best) {
          best = Math.abs(off);
          nearest = i;
        }
      });
      setStyle(barRef.current!, "transform", `scaleX(${k.toFixed(4)})`);
      const count = String(Math.min(nearest, games.length - 1) + 1).padStart(2, "0");
      if (count !== lastCount) countRef.current!.textContent = lastCount = count;
    });
    return () => {
      off();
      pin.release();
    };
  }, []);

  const cardRef = (i: number) => (el: HTMLLIElement | null) => {
    if (el) cardRefs.current[i] = el;
  };
  const CARD = "w-[78vw] shrink-0 origin-bottom will-change-[transform,opacity] sm:w-[52vw] md:w-[clamp(22rem,36vw,32rem)]";

  return (
    <section ref={rootRef} id="games" aria-labelledby="games-title" className="relative" style={{ height: `${SECTION_VH}svh` }}>
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden pt-16 md:flex-row md:items-center md:justify-start">
        {/* On wide screens the reel slides under this column: a paper backing, feathered
            into the reel along its right edge. */}
        <div className="relative z-10 shrink-0 px-5 sm:px-8 md:flex md:w-[32vw] md:flex-col md:justify-center md:self-stretch md:bg-paper md:pr-10 md:pl-[6vw] md:after:pointer-events-none md:after:absolute md:after:inset-y-0 md:after:left-full md:after:w-20 md:after:bg-linear-to-r md:after:from-paper md:after:to-transparent">
          <p className="eyebrow">The lineup</p>
          <h2 id="games-title" className="mt-4 text-section">
            Pick a game.
          </h2>
          <p className="mt-5 max-w-[26rem] text-lead max-md:hidden">Each one takes a few minutes and comes back with a new challenge every day.</p>
          <div className="mt-8 flex items-center gap-4 label-mono text-stone-500 max-md:hidden" aria-hidden>
            <span>
              <span ref={countRef} className="text-stone-100">
                01
              </span>{" "}
              / {String(games.length).padStart(2, "0")}
            </span>
            <span className="relative h-px w-32 bg-ink/15">
              <span ref={barRef} className="absolute inset-0 origin-left bg-gold" style={{ transform: "scaleX(0)" }} />
            </span>
          </div>
        </div>

        <ol ref={trackRef} data-paused className="mt-8 flex gap-5 pl-5 will-change-transform sm:pl-8 md:mt-0 md:gap-7 md:pl-0">
          {games.map((g, i) => (
            <li key={g.id} ref={cardRef(i)} className={CARD}>
              <Link to={g.path} className="group block">
                <div className="relative h-64 transition-transform duration-300 ease-mirai group-hover:-translate-y-1 md:h-80 [&>div]:h-full">
                  <g.Cover />
                </div>
                <div className="mt-4 flex gap-4">
                  <span className="label-mono text-ember-500">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-light tracking-tight uppercase sm:text-2xl">{g.title}</span>
                    <span className="mt-1.5 block font-serif text-sm leading-relaxed text-stone-400 max-sm:line-clamp-2">{g.tagline}</span>
                    <span className="mt-2 block label-mono text-stone-500">
                      <g.Status />
                    </span>
                  </span>
                  <span aria-hidden className="self-start label-mono text-stone-300 transition-transform group-hover:translate-x-0.5">
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {/* The next slot, still in the workshop. */}
          <li ref={cardRef(games.length)} className={CARD}>
            <div className="grid h-64 place-items-center rounded-xs border border-dashed border-ink/25 md:h-80">
              <div className="text-center">
                <p className="eyebrow text-stone-500!">Game {String(games.length + 1).padStart(2, "0")}</p>
                <p className="mt-2 font-display text-xl font-light tracking-tight text-stone-300 uppercase">Coming soon</p>
                <p className="mt-1 font-serif text-sm text-stone-500">In the workshop. Check back soon.</p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
