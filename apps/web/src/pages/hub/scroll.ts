import { useEffect, useState } from "react";
import Lenis from "lenis";

/**
 * One rAF loop for the hub page. Lenis advances first, then every scroll-driven section
 * gets the frame's scroll position and writes styles directly: nothing goes through React
 * state while scrolling, so the page never re-renders mid-scroll.
 *
 * Nothing reads layout per frame. The scroll position and the viewport are read once at
 * the top of the frame, before any writes; section geometry is measured only when the
 * page resizes. Reading a rect after another section has written its styles would force
 * a synchronous layout, once per section, every frame.
 */

export interface Frame {
  time: number;
  /** Scroll position this frame. */
  y: number;
  vw: number;
  vh: number;
}

type Tick = (frame: Frame) => void;

const subscribers = new Set<Tick>();
const measurers = new Set<(vw: number, vh: number) => void>();
/** Set when the geometry may have changed; the next frame re-measures before anything runs. */
let dirty = true;
const view = { vw: 0, vh: 0 };

export function startScroll(reducedMotion: boolean): () => void {
  const lenis = reducedMotion ? null : new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
  const invalidate = () => {
    dirty = true;
  };
  window.addEventListener("resize", invalidate);
  const ro = new ResizeObserver(invalidate);
  ro.observe(document.body);

  let raf = 0;
  const loop = (time: number) => {
    lenis?.raf(time);
    if (dirty) {
      dirty = false;
      view.vw = window.innerWidth;
      view.vh = window.innerHeight;
      measurers.forEach((fn) => fn(view.vw, view.vh));
    }
    const frame = { time, y: lenis ? lenis.animatedScroll : window.scrollY, vw: view.vw, vh: view.vh };
    subscribers.forEach((fn) => fn(frame));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", invalidate);
    ro.disconnect();
    lenis?.destroy();
  };
}

export function onFrame(fn: Tick): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Tracks a tall section whose child is `position: sticky`. `progress` is 0 when the
 * section's top meets the viewport top and 1 when the sticky child is about to unpin;
 * `onscreen` is whether any of it is in view. `extra` measures anything else the section
 * needs, on the same resize-only schedule.
 */
export function trackPin(el: HTMLElement, extra?: (vw: number, vh: number) => void) {
  let top = 0;
  let height = 0;
  let span = 1;
  const measure = (vw: number, vh: number) => {
    top = el.getBoundingClientRect().top + window.scrollY;
    height = el.offsetHeight;
    span = Math.max(1, height - vh);
    extra?.(vw, vh);
  };
  measurers.add(measure);
  dirty = true;
  return {
    at(f: Frame) {
      const rel = f.y - top;
      return { p: clamp(rel / span), onscreen: rel < height && rel > -f.vh };
    },
    release() {
      measurers.delete(measure);
    },
  };
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Where `v` sits between `a` and `b`, clamped to 0–1. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Sets a style property only when it changes, so idle frames touch nothing. */
export function setStyle(el: HTMLElement | SVGElement, prop: "transform" | "opacity" | "visibility", value: string) {
  if (el.style[prop] !== value) el.style[prop] = value;
}

/** Milliseconds until the next daily unlocks (midnight UTC). */
export function msToNextDaily(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 18_345_000 → { h: "05", m: "05", s: "45" }. */
export function splitClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return { h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
}

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
