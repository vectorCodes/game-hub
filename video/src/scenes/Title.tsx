import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BEAT, hit } from "../beats";
import { CameraRig, Cyclorama, Fill, KeyLight, orbit, ShadowObject, StageCanvas } from "../stage/Stage";
import { RevealText, Slam, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 4–8 s: a whip round behind the wall shows what casts the shadow; the title lands. */
export const Title = () => {
  const frame = useCurrentFrame();
  // Fast whip on the downbeat, then a slow drift for the rest of the bar.
  const whip = interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const azimuth = -42 + whip * 92 + interpolate(frame, [20, 120], [0, 10], clamp);
  const elevation = 4 + whip * 8;
  const punch = hit(frame, BEAT, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig position={orbit([0, -0.4, -1.5], 16.5, azimuth, elevation)} target={[-8.8 * whip, -0.7, -1.5]} fov={32} roll={(1 - whip) * -8} />
        <Fill />
        <KeyLight />
        <Cyclorama />
        <ShadowObject model="astronaut" angle={{ azimuth: 20, elevation: 0 }} clay={1} />
      </StageCanvas>
      <Vignette />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "linear-gradient(90deg, rgba(14,20,17,0.9) 0%, rgba(14,20,17,0.45) 40%, transparent 62%)",
          opacity: whip,
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <Slam at={BEAT} from={1.15} style={{ fontFamily: bodyFont, fontSize: 24, fontWeight: 600, letterSpacing: "0.22em", color: colors.moss }}>
          THE DAILY 3D SHADOW PUZZLE
        </Slam>
        <div style={{ scale: String(1 + punch * 0.06), transformOrigin: "left center" }}>
          <RevealText
            text="Shadow Guess"
            start={BEAT}
            stagger={4}
            duration={14}
            style={{ marginTop: 18, fontFamily: displayFont, fontSize: 120, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.045em", color: colors.text }}
          />
        </div>
        <Slam at={BEAT * 3} from={1.1} style={{ marginTop: 28, fontFamily: bodyFont, fontSize: 42, color: colors.muted }}>
          Name the object from its shadow.
        </Slam>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
