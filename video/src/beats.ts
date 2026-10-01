import { Easing, interpolate } from "remotion";

// The whole edit sits on a 120 BPM grid so cuts land on the music.
export const FPS = 30;
export const BPM = 120;
/** Frames per beat (0.5 s). */
export const BEAT = (FPS * 60) / BPM;
/** Frames per bar of 4 beats (2 s). */
export const BAR = BEAT * 4;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 1 → 0 over `length` frames after `at`, eased out: drives scale punches and pops. */
export function hit(frame: number, at: number, length = 8) {
  return interpolate(frame, [at, at + length], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
}

/** 0 → 1 over `length` frames after `at`, with a quick expo-out. */
export function snap(frame: number, at: number, length = 8) {
  return interpolate(frame, [at, at + length], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
}
