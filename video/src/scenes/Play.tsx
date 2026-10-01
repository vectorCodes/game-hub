import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  CameraRig,
  Cyclorama,
  Fill,
  keyframes,
  KeyLight,
  ShadowObject,
  slerpAngle,
  StageCanvas,
  WALL_Z,
  type LightAngle,
} from "../stage/Stage";
import { useFade, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont, ease, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The first three of the game's DEFAULT_ANGLES, then a pose facing the final camera.
const ANGLE_1: LightAngle = { azimuth: 0, elevation: 90 };
const ANGLE_2: LightAngle = { azimuth: 35, elevation: 65 };
const ANGLE_3: LightAngle = { azimuth: 160, elevation: 40 };
const REVEAL: LightAngle = { azimuth: 42, elevation: 0 };

// Beats: when each guess is submitted.
const MISS_1 = 46;
const MISS_2 = 128;
const SOLVE = 228;

/** Letters typed so far, at a steady typing speed. */
function typed(frame: number, text: string, start: number) {
  return text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - start) / 2.6))));
}

function GuessRow({ text, correct, at }: { text: string; correct: boolean; at: number }) {
  const { opacity, rise } = useFade(at, 18);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 0",
        borderTop: `1px solid ${colors.hairline}`,
        opacity,
        translate: `0px ${rise * 0.6}px`,
        fontSize: 32,
        color: correct ? colors.text : colors.faint,
        textDecoration: correct ? "none" : "line-through",
        textDecorationColor: "rgba(245,243,255,0.35)",
      }}
    >
      <span>{text}</span>
      <span style={{ fontSize: 26, fontWeight: 600, textDecoration: "none", color: correct ? colors.cyan : colors.miss }}>
        {correct ? "Correct" : "Miss"}
      </span>
    </div>
  );
}

/** Game panel: current angle, what a solve is worth, the guesses so far and the input. */
function Panel({ frame }: { frame: number }) {
  const panel = useFade(6, 26);
  const worth = Math.round(
    frame < MISS_2
      ? interpolate(frame, [MISS_1, MISS_1 + 16], [100, 85], clamp)
      : interpolate(frame, [MISS_2, MISS_2 + 16], [85, 70], clamp),
  );
  const angle = frame < MISS_1 + 6 ? 1 : frame < MISS_2 + 6 ? 2 : 3;
  const solved = frame >= SOLVE;
  const input =
    frame < MISS_1 ? typed(frame, "Potato", 18) : frame < MISS_2 ? typed(frame, "Rock", 106) : frame < SOLVE ? typed(frame, "Reindeer", 194) : "";
  const caretOn = Math.floor(frame / 16) % 2 === 0;
  const solvedCard = useFade(SOLVE + 8, 22);

  return (
    <div
      style={{
        position: "absolute",
        right: 140,
        top: 190,
        width: 600,
        padding: "44px 48px",
        borderRadius: 32,
        background: "rgba(22,17,46,0.62)",
        border: `1px solid ${colors.hairline}`,
        boxShadow: "0 40px 120px -40px rgba(0,0,0,0.8)",
        backdropFilter: "blur(24px)",
        fontFamily: bodyFont,
        color: colors.text,
        opacity: panel.opacity,
        translate: `0px ${panel.rise}px`,
      }}
    >
      <div style={{ fontFamily: displayFont, fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.08 }}>
        Every miss
        <br />
        <span style={{ color: colors.muted }}>turns the light.</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 40, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>ANGLE</div>
          <div style={{ marginTop: 8, fontSize: 44, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {angle} <span style={{ color: colors.faint }}>/ 6</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>WORTH</div>
          <div style={{ marginTop: 4, fontFamily: displayFont, fontSize: 84, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: colors.cyan }}>
            {worth}
          </div>
        </div>
      </div>

      <GuessRow text="Potato" correct={false} at={MISS_1} />
      {frame >= MISS_2 && <GuessRow text="Rock" correct={false} at={MISS_2} />}
      {frame >= SOLVE && <GuessRow text="Reindeer" correct at={SOLVE} />}

      <div style={{ position: "relative", marginTop: 22, height: 84 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${colors.hairline}`,
            fontSize: 32,
            opacity: 1 - solvedCard.opacity,
          }}
        >
          {input ? input : <span style={{ color: colors.faint }}>Name the object…</span>}
          <span style={{ width: 3, height: 36, marginLeft: 3, background: colors.pink, opacity: caretOn && !solved ? 1 : 0 }} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            background: "linear-gradient(100deg, #8b5cf6, #d946ef 55%, #ec4899)",
            fontSize: 32,
            fontWeight: 600,
            opacity: solvedCard.opacity,
            scale: interpolate(frame, [SOLVE + 8, SOLVE + 30], [0.96, 1], { ...clamp, easing: Easing.bezier(...ease) }),
          }}
        >
          Solved in 3 angles · 70 points
        </div>
      </div>
    </div>
  );
}

/** A mock round: two misses turn the light, the third guess solves it. */
export const Play = () => {
  const frame = useCurrentFrame();
  const turn = (start: number) => interpolate(frame, [start, start + 34], [0, 1], { ...clamp, easing: Easing.bezier(...glide) });

  let quaternion = slerpAngle(ANGLE_1, ANGLE_2, turn(MISS_1 + 6));
  if (frame >= MISS_2) quaternion = slerpAngle(ANGLE_2, ANGLE_3, turn(MISS_2 + 6));
  if (frame >= SOLVE) quaternion = slerpAngle(ANGLE_3, REVEAL, turn(SOLVE + 4));

  // Three camera angles, joined by slow glides instead of cuts.
  const position = keyframes(frame, [
    [0, [3.4, 0.2, 13.8]],
    [56, [3.2, 0.1, 13]],
    [100, [-3.6, -3.9, 12]],
    [150, [-3.1, -3.6, 11.4]],
    [196, [9.5, 4.6, 10.4]],
    [236, [9.2, 4.2, 10]],
    [296, [8.4, 1.1, 7.6]],
  ]);
  const target = keyframes(frame, [
    [0, [3.4, -0.2, WALL_Z]],
    [56, [3.2, -0.2, WALL_Z]],
    [100, [3.1, 0.5, WALL_Z]],
    [150, [3.1, 0.5, WALL_Z]],
    [196, [2.4, -0.6, -3]],
    [236, [2.4, -0.6, -3]],
    [296, [2.0, -0.4, -1.4]],
  ]);
  const reveal = interpolate(frame, [SOLVE + 6, SOLVE + 42], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig position={position} target={target} fov={32} />
        <Fill intensity={1 + reveal * 1.5} />
        <ambientLight intensity={reveal * 0.5} />
        <KeyLight />
        <Cyclorama />
        <ShadowObject model="reindeer" quaternion={quaternion} reveal={reveal} />
      </StageCanvas>
      <Vignette />
      <Panel frame={frame} />
    </AbsoluteFill>
  );
};
