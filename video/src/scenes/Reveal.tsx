import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CameraRig, Cyclorama, Fill, KeyLight, orbit, ShadowObject, StageCanvas, track } from "../stage/Stage";
import { Eyebrow, RevealText, useFade, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * One continuous camera move from the player's view round to the side, revealing the
 * object between the light and the wall. The title settles in on the left.
 */
export const Reveal = () => {
  const frame = useCurrentFrame();
  const move = { ...clamp, easing: Easing.bezier(...glide) };
  const azimuth = interpolate(frame, [0, 150], [-6, 52], move);
  const elevation = interpolate(frame, [0, 150], [1, 12], move);
  const radius = interpolate(frame, [0, 150], [15, 16.5], move);
  const eyebrow = useFade(88, 24);
  const tagline = useFade(112, 24);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig
          position={orbit([0, -0.4, -1.5], radius, azimuth, elevation)}
          target={track(frame, [0, 150], [0, -0.4, -2.5], [-7.2, -0.8, -1.5])}
          fov={32}
        />
        <Fill />
        <KeyLight />
        <Cyclorama />
        <ShadowObject
          model="chair"
          angle={{ azimuth: 96, elevation: 0 }}
          clay={interpolate(frame, [62, 104], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) })}
        />
      </StageCanvas>
      <Vignette />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "linear-gradient(90deg, rgba(8,6,26,0.9) 0%, rgba(8,6,26,0.5) 38%, transparent 62%)",
          opacity: interpolate(frame, [70, 110], [0, 1], clamp),
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 140 }}>
        <Eyebrow style={{ fontFamily: bodyFont, color: colors.muted, opacity: eyebrow.opacity, translate: `0px ${eyebrow.rise}px` }}>
          A daily puzzle game
        </Eyebrow>
        <RevealText
          text="Shadow Guess"
          start={94}
          stagger={5}
          duration={28}
          style={{ marginTop: 22, fontFamily: displayFont, fontSize: 124, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.045em", color: colors.text }}
        />
        <div
          style={{
            marginTop: 30,
            fontFamily: bodyFont,
            fontSize: 42,
            fontWeight: 400,
            color: colors.muted,
            opacity: tagline.opacity,
            translate: `0px ${tagline.rise}px`,
          }}
        >
          Name the object from its shadow.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
