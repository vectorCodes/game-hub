import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CameraRig, Cyclorama, Fill, KeyLight, ShadowObject, StageCanvas, track, WALL_Z } from "../stage/Stage";
import { FadeBlack, RevealText, Vignette } from "../stage/Type";
import { colors, displayFont, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Out of black, the light slowly comes up on a single shadow while the camera eases
 * in. The shadow sits right of centre to leave room for the line.
 */
export const Open = () => {
  const frame = useCurrentFrame();
  const light = interpolate(frame, [0, 50], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig
          position={track(frame, [0, 150], [-3.4, 0.2, 15], [-3.0, 0, 12.5])}
          target={track(frame, [0, 150], [-3.4, -0.2, WALL_Z], [-3.0, -0.3, WALL_Z])}
          fov={32}
        />
        <Fill intensity={light} />
        <KeyLight intensity={light} />
        <Cyclorama />
        <ShadowObject
          model="chair"
          angle={{
            azimuth: interpolate(frame, [0, 150], [74, 96], { ...clamp, easing: Easing.bezier(...glide) }),
            elevation: 0,
          }}
        />
      </StageCanvas>
      <Vignette />

      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 160 }}>
        <RevealText
          text="Every object"
          start={44}
          exit={128}
          style={{ fontFamily: displayFont, fontSize: 112, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.035em", color: colors.text }}
        />
        <RevealText
          text="leaves a *clue.*"
          start={54}
          exit={128}
          style={{ fontFamily: displayFont, fontSize: 112, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.035em", color: colors.text }}
          accent={{ color: colors.muted }}
        />
      </AbsoluteFill>

      <FadeBlack from={0} to={24} />
    </AbsoluteFill>
  );
};
