import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

/**
 * Where the visitor is in the landing-page journey, shared between the DOM sections and
 * the 3D world. `chapter` is fractional: 0 when the first section is centred in the
 * viewport, 1 for the second, and so on. The 3D scene reads it every frame.
 */
export const journey = {
  chapter: 0,
  /** Set when the visitor prefers reduced motion: the world stays still. */
  still: false,
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Fractional chapter from the scroll position: the camera holds while a section is centred. */
function measure(sections: HTMLElement[]) {
  const mid = window.scrollY + window.innerHeight / 2;
  const centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
  if (mid <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (mid < centers[i + 1]) {
      const f = (mid - centers[i]) / (centers[i + 1] - centers[i]);
      // Ease each leg so the camera lingers at every stop and glides in between.
      return i + smoothstep(0.12, 0.88, f);
    }
  }
  return centers.length - 1;
}

/**
 * Smooth momentum scrolling (Lenis) plus chapter tracking for the sections inside
 * `container` that carry a `data-chapter` attribute.
 */
export function useJourney(container: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>("[data-chapter]")];
    journey.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const update = () => {
      journey.chapter = measure(sections);
    };
    update();

    let lenis: Lenis | null = null;
    let raf = 0;
    if (!journey.still) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      lenis.on("scroll", update);
      const loop = (time: number) => {
        lenis!.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      journey.chapter = 0;
    };
  }, [container]);
}
