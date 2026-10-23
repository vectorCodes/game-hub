// GSAP for the landing pages: the plugins, registered once, and a hook that runs a page's
// tweens in one gsap.matchMedia scope, so they're all reverted on unmount and re-run when
// the reader's reduced-motion setting changes.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

/**
 * Runs `setup` on the element the returned ref lands on, with `reduced` true for readers who
 * asked for less motion (show the end state, skip the flourish). Selector strings in tweens
 * are scoped to that element. Return a cleanup for anything GSAP doesn't own.
 */
export function useGsap<T extends HTMLElement>(setup: (root: T, reduced: boolean) => void | (() => void), deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia(root);
    mm.add({ reduced: "(prefers-reduced-motion: reduce)" }, (ctx) => setup(root, !!ctx.conditions?.reduced));
    return () => mm.revert();
  }, deps);
  return ref;
}

/**
 * Counts each `[data-count]` element under `root` up from 0 to its value as it scrolls into
 * view. Call it only when motion is welcome: otherwise the numbers just stand there. Writes
 * to the element's own text node, the one React keeps, so React's later updates still land.
 */
export function countUp(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-count]")) {
    const to = Number(el.dataset.count);
    const text = el.firstChild;
    if (!Number.isFinite(to) || to <= 0 || !(text instanceof Text)) continue;
    const final = text.nodeValue;
    const n = { v: 0 };
    text.nodeValue = "0";
    gsap.to(n, {
      v: to,
      duration: 1.4,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: () => void (text.nodeValue = Math.round(n.v).toLocaleString()),
      onComplete: () => void (text.nodeValue = final),
      onInterrupt: () => void (text.nodeValue = final),
    });
  }
}
