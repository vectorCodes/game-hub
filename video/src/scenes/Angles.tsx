import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BEAT, hit } from "../beats";
import { CameraRig, Cyclorama, Fill, KeyLight, ShadowObject, slerpAngle, StageCanvas, track, WALL_Z, type LightAngle } from "../stage/Stage";
import { Slam, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The locomotive's own six angles from assets/catalog.json: hardest (top-down) to
// easiest (clean side profile).
const ANGLES: LightAngle[] = [
  { azimuth: 0, elevation: 90 },
  { azimuth: 35, elevation: 65 },
  { azimuth: 160, elevation: 40 },
  { azimuth: 90, elevation: 15 },
  { azimuth: 55, elevation: 10 },
  { azimuth: 0, elevation: 0 },
];

/** 20–24 s: one shadow snaps through all six angles, one per beat. */
export const Angles = () => {
  const frame = useCurrentFrame();
  const step = Math.min(5, Math.floor(frame / BEAT));
  const from = ANGLES[Math.max(0, step - 1)];
  const t = step === 0 ? 1 : interpolate(frame, [step * BEAT, step * BEAT + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const punch = hit(frame, step * BEAT, 8);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig position={track(frame, [0, 120], [3.0, 0.1, 14.5], [2.8, 0, 12.8])} target={[3.0, -0.3, WALL_Z]} fov={32} />
        <Fill />
        <KeyLight />
        <Cyclorama />
        <ShadowObject model="locomotive" quaternion={slerpAngle(from, ANGLES[step], t)} />
      </StageCanvas>
      <Vignette />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingRight: 150, textAlign: "right" }}>
        <div style={{ fontFamily: bodyFont, fontSize: 24, fontWeight: 600, letterSpacing: "0.22em", color: colors.muted }}>ANGLE</div>
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 300,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: "-0.05em",
            color: colors.text,
            fontVariantNumeric: "tabular-nums",
            scale: String(1 + punch * 0.1),
            transformOrigin: "right center",
          }}
        >
          {step + 1}
          <span style={{ marginLeft: 12, color: colors.faint, fontSize: 120 }}>/6</span>
        </div>
        {/* One tick per angle, filling in as the light turns. */}
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          {ANGLES.map((_, i) => (
            <div
              key={i}
              style={{
                width: 46,
                height: 8,
                borderRadius: 99,
                background: i <= step ? "linear-gradient(90deg, #f8cf72, #e9a03a)" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
        <Slam at={BEAT * 6} from={1.1} style={{ marginTop: 36, fontFamily: displayFont, fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em", color: colors.text }}>
          Hardest first.
          <br />
          <span style={{ color: colors.muted }}>Clearer every miss.</span>
        </Slam>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
