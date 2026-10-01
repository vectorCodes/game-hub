import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { BAR, BEAT, hit, snap } from "../beats";
import {
  CameraRig,
  Cyclorama,
  Fill,
  KeyLight,
  ShadowObject,
  slerpAngle,
  StageCanvas,
  track,
  WALL_Z,
  type LightAngle,
  type Vec3,
} from "../stage/Stage";
import { Vignette } from "../stage/Type";
import { accentGradient, bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The first three of the game's DEFAULT_ANGLES, then a pose facing the last camera.
const ANGLE_1: LightAngle = { azimuth: 0, elevation: 90 };
const ANGLE_2: LightAngle = { azimuth: 35, elevation: 65 };
const ANGLE_3: LightAngle = { azimuth: 160, elevation: 40 };
const REVEAL: LightAngle = { azimuth: 42, elevation: 0 };

// One bar per guess: type on beats 1–2, submit on beat 3, cut to a new camera on the next downbeat.
const MISS_1 = BEAT * 3;
const MISS_2 = BAR + BEAT * 3;
const SOLVE = BAR * 2 + BEAT * 3;
const CUT_2 = BAR;
const CUT_3 = BAR * 2;
const CUT_4 = BAR * 3;

function typed(frame: number, text: string, start: number) {
  return text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - start) / 2.2))));
}

/** Each shot moves slightly within its bar; shots change with a hard cut. */
function shot(frame: number): { position: Vec3; target: Vec3 } {
  if (frame < CUT_2) return { position: track(frame, [0, CUT_2], [3.4, 0.1, 14.2], [3.2, 0, 12.6]), target: [3.4, -0.2, WALL_Z] };
  if (frame < CUT_3) return { position: track(frame, [CUT_2, CUT_3], [-3.8, -4, 12], [-2.8, -3.6, 11]), target: [3.1, 0.6, WALL_Z] };
  if (frame < CUT_4) return { position: track(frame, [CUT_3, CUT_4], [9.8, 4.8, 10.6], [9, 4.2, 9.8]), target: [2.4, -0.6, -3] };
  return { position: track(frame, [CUT_4, CUT_4 + BAR], [9.8, 1.6, 9.2], [7.6, 0.9, 7.2]), target: [2.0, -0.4, -1.4] };
}

function GuessRow({ text, correct, at, frame }: { text: string; correct: boolean; at: number; frame: number }) {
  const t = snap(frame, at, 10);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 0",
        borderTop: `1px solid ${colors.hairline}`,
        opacity: t,
        translate: `${(1 - t) * 30}px 0px`,
        fontSize: 32,
        color: correct ? colors.text : colors.faint,
      }}
    >
      <span style={{ textDecoration: correct ? "none" : "line-through", textDecorationColor: "rgba(246,243,234,0.35)" }}>{text}</span>
      <span style={{ fontSize: 24, fontWeight: 600, color: correct ? colors.moss : colors.miss }}>{correct ? "Correct" : "Miss"}</span>
    </div>
  );
}

function Panel({ frame }: { frame: number }) {
  const enter = snap(frame, 0, 14);
  const worth = frame < MISS_1 ? 100 : frame < MISS_2 ? 85 : 70;
  const lastMiss = frame < MISS_2 ? MISS_1 : MISS_2;
  const shake = frame >= lastMiss && frame < SOLVE ? Math.sin((frame - lastMiss) * 2.2) * 14 * hit(frame, lastMiss, 12) : 0;
  const angle = frame < CUT_2 ? 1 : frame < CUT_3 ? 2 : 3;
  const input = frame < MISS_1 ? typed(frame, "Potato", 16) : frame < MISS_2 ? typed(frame, "Rock", BAR + 18) : frame < SOLVE ? typed(frame, "Reindeer", BAR * 2 + 16) : "";
  const solved = snap(frame, SOLVE, 10);

  return (
    <div
      style={{
        position: "absolute",
        right: 140,
        top: 200,
        width: 600,
        padding: "40px 46px",
        borderRadius: 32,
        background: "rgba(23,32,25,0.7)",
        border: `1px solid ${colors.hairline}`,
        boxShadow: "0 40px 120px -40px rgba(0,0,0,0.8)",
        backdropFilter: "blur(24px)",
        fontFamily: bodyFont,
        color: colors.text,
        opacity: enter,
        translate: `${(1 - enter) * 80 + shake}px 0px`,
      }}
    >
      <div style={{ fontFamily: displayFont, fontSize: 46, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.08 }}>
        Every miss
        <br />
        <span style={{ color: colors.muted }}>turns the light.</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 34, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>ANGLE</div>
          <div style={{ marginTop: 8, fontSize: 44, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {angle} <span style={{ color: colors.faint }}>/ 6</span>
          </div>
        </div>
        <div style={{ position: "relative", textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>WORTH</div>
          <div
            style={{
              marginTop: 4,
              fontFamily: displayFont,
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              color: colors.moss,
              scale: String(1 + hit(frame, lastMiss, 10) * (frame >= MISS_1 ? 0.18 : 0)),
              transformOrigin: "right center",
            }}
          >
            {worth}
          </div>
          {/* "−15" floats up off the score on each miss. */}
          {[MISS_1, MISS_2].map((at) =>
            frame >= at && frame < at + 24 ? (
              <div
                key={at}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -30 - (frame - at) * 1.6,
                  fontSize: 30,
                  fontWeight: 700,
                  color: colors.miss,
                  opacity: interpolate(frame - at, [0, 4, 16, 24], [0, 1, 1, 0]),
                }}
              >
                −15
              </div>
            ) : null,
          )}
        </div>
      </div>

      {frame >= MISS_1 && <GuessRow text="Potato" correct={false} at={MISS_1} frame={frame} />}
      {frame >= MISS_2 && <GuessRow text="Rock" correct={false} at={MISS_2} frame={frame} />}
      {frame >= SOLVE && <GuessRow text="Reindeer" correct at={SOLVE} frame={frame} />}

      <div style={{ position: "relative", marginTop: 20, height: 80 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 26px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${colors.hairline}`,
            fontSize: 32,
            opacity: 1 - solved,
          }}
        >
          {input || <span style={{ color: colors.faint }}>Name the object…</span>}
          <span style={{ width: 3, height: 34, marginLeft: 3, background: colors.lamp, opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            background: accentGradient,
            fontSize: 32,
            fontWeight: 600,
            color: colors.ink,
            opacity: solved,
            scale: String(0.9 + 0.1 * solved),
          }}
        >
          Solved · 70 points
        </div>
      </div>
    </div>
  );
}

/** Confetti bursting from the object when it's solved (deterministic per seed). */
function Confetti({ frame }: { frame: number }) {
  const t = frame - SOLVE - 4;
  if (t < 0 || t > 50) return null;
  const palette = ["#f8cf72", "#e9a03a", "#e9a03a", "#b3d993", "#f6f3ea"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 46 }, (_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const speed = 9 + random(`s${i}`) * 16;
        const x = 640 + Math.cos(a) * speed * t;
        const y = 520 + Math.sin(a) * speed * t + 0.35 * t * t;
        const size = 8 + random(`z${i}`) * 10;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * 0.5,
              borderRadius: 2,
              background: palette[i % palette.length],
              rotate: `${t * (8 + random(`r${i}`) * 14)}deg`,
              opacity: interpolate(t, [0, 36, 50], [1, 1, 0]),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** 8–16 s: a full round in four bars. */
export const Round = () => {
  const frame = useCurrentFrame();
  const turn = (at: number) => interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  let quaternion = slerpAngle(ANGLE_1, ANGLE_2, turn(CUT_2));
  if (frame >= CUT_3) quaternion = slerpAngle(ANGLE_2, ANGLE_3, turn(CUT_3));
  if (frame >= SOLVE) quaternion = slerpAngle(ANGLE_3, REVEAL, turn(SOLVE + 2));
  const reveal = interpolate(frame, [SOLVE + 2, SOLVE + 14], [0, 1], clamp);
  const { position, target } = shot(frame);

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
      <Confetti frame={frame} />
      <Panel frame={frame} />
    </AbsoluteFill>
  );
};
