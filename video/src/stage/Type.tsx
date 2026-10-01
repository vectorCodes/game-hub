import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ease } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Words rise into place from behind a mask, one after another, and fade out together.
 * Wrap a word in `*asterisks*` to give it the `accent` style.
 */
export function RevealText({
  text,
  start,
  exit,
  stagger = 3,
  duration = 22,
  style,
  accent,
}: {
  text: string;
  /** Frame the first word starts rising. */
  start: number;
  /** Frame the whole line starts fading out, if it leaves before the scene ends. */
  exit?: number;
  stagger?: number;
  duration?: number;
  style?: CSSProperties;
  accent?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const out = exit === undefined ? 1 : interpolate(frame, [exit, exit + 14], [1, 0], clamp);
  const outShift = exit === undefined ? 0 : interpolate(frame, [exit, exit + 14], [0, -14], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ ...style, opacity: out, translate: `0px ${outShift}px` }}>
      {words.map((word, i) => {
        const t = interpolate(frame, [start + i * stagger, start + i * stagger + duration], [0, 1], {
          ...clamp,
          easing: Easing.bezier(...ease),
        });
        const accented = word.startsWith("*") && word.endsWith("*");
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
            <span
              style={{
                display: "inline-block",
                translate: `0px ${(1 - t) * 105}%`,
                opacity: interpolate(t, [0, 0.4], [0, 1], clamp),
                ...(accented ? accent : null),
              }}
            >
              {accented ? word.slice(1, -1) : word}
            </span>
            {i < words.length - 1 && " "}
          </span>
        );
      })}
    </div>
  );
}

/** A soft fade in/out driven by frames, for non-text elements. */
export function useFade(start: number, length = 20, exit?: number) {
  const frame = useCurrentFrame();
  const inT = interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing: Easing.bezier(...ease) });
  const outT = exit === undefined ? 1 : interpolate(frame, [exit, exit + 14], [1, 0], clamp);
  return { opacity: inT * outT, rise: (1 - inT) * 24 };
}

/** Darkens the frame edges a touch, to hold the eye in the light pool. */
export function Vignette({ strength = 0.5 }: { strength?: number }) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 80% 75% at 50% 45%, transparent 55%, rgba(8,6,26,${strength}))`,
      }}
    />
  );
}

/** Fades from or to black, so the video loops without a jump. */
export function FadeBlack({ from, to, reverse = false }: { from: number; to: number; reverse?: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, to], reverse ? [0, 1] : [1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  return <AbsoluteFill style={{ backgroundColor: "#000", opacity, pointerEvents: "none" }} />;
}

/** Small uppercase label above a headline. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", ...style }}>{children}</div>;
}
