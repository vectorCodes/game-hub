import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BEAT, hit } from "../beats";
import type { ModelName } from "../stage/models";
import { CameraRig, Cyclorama, Fill, KeyLight, ShadowObject, StageCanvas, track, WALL_Z, type LightAngle } from "../stage/Stage";
import { FadeBlack, Slam, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont } from "../theme";

/** One shadow per beat, each from its most readable side. */
const LINEUP: { model: ModelName; angle: LightAngle }[] = [
  { model: "chair", angle: { azimuth: 90, elevation: 0 } },
  { model: "astronaut", angle: { azimuth: 20, elevation: 0 } },
  { model: "palmTree", angle: { azimuth: 10, elevation: 0 } },
  { model: "reindeer", angle: { azimuth: 90, elevation: 0 } },
  { model: "iceCream", angle: { azimuth: 0, elevation: 0 } },
  { model: "cactus", angle: { azimuth: 0, elevation: 0 } },
  { model: "locomotive", angle: { azimuth: 90, elevation: 0 } },
  { model: "snowman", angle: { azimuth: 0, elevation: 0 } },
];

/** 0–4 s: eight shadows snap onto the wall, one per beat. "Can you name them all?" */
export const Hook = () => {
  const frame = useCurrentFrame();
  const index = Math.min(LINEUP.length - 1, Math.floor(frame / BEAT));
  const { model, angle } = LINEUP[index];
  const punch = hit(frame, index * BEAT, 7);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig position={track(frame, [0, 120], [-2.8, 0.1, 15], [-2.6, 0, 12.6])} target={[-2.8, -0.3, WALL_Z]} fov={32} />
        <Fill />
        <KeyLight />
        <Cyclorama />
        <group scale={1 + punch * 0.12} rotation={[0, 0, punch * 0.06]}>
          <ShadowObject key={model} model={model} angle={angle} />
        </group>
      </StageCanvas>
      <Vignette />

      {/* Giant beat counter on the left. */}
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 150 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 24, fontWeight: 600, letterSpacing: "0.22em", color: colors.muted }}>SHADOW</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: displayFont,
            fontSize: 280,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: "-0.05em",
            color: colors.text,
            fontVariantNumeric: "tabular-nums",
            scale: String(1 + punch * 0.08),
            transformOrigin: "left center",
          }}
        >
          0{index + 1}
        </div>
        <div style={{ marginTop: 10, fontFamily: bodyFont, fontSize: 34, color: colors.faint, fontVariantNumeric: "tabular-nums" }}>of 08</div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", paddingLeft: 150, paddingBottom: 130 }}>
        <Slam
          at={BEAT * 6}
          style={{
            padding: "22px 44px",
            borderRadius: 999,
            background: "rgba(14,20,17,0.78)",
            border: `1px solid ${colors.hairline}`,
            fontFamily: displayFont,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: colors.text,
          }}
        >
          Can you name them all?
        </Slam>
      </AbsoluteFill>

      <FadeBlack from={0} to={10} />
    </AbsoluteFill>
  );
};
