import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CameraRig, Cyclorama, Fill, FLOOR_Y, KeyLight, orbit, ShadowObject, StageCanvas, type Vec3 } from "../stage/Stage";
import { FadeBlack, RevealText, useFade } from "../stage/Type";
import { accentGradient, bodyFont, colors, displayFont, ease, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CENTER: Vec3 = [0, FLOOR_Y, 5];
const RING = 5.6;
const SIZE = 2.4;

const place = (i: number): Vec3 => {
  const a = ((i + 0.5) / 7) * Math.PI * 2;
  return [CENTER[0] + Math.sin(a) * RING, FLOOR_Y, CENTER[2] + Math.cos(a) * RING];
};

/** The site logo: a lamp and the shadow it casts. */
function Logo() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: 76,
        height: 76,
        borderRadius: 22,
        backgroundImage: accentGradient,
        boxShadow: "0 0 50px -8px rgba(217,70,239,0.7)",
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 999, translate: "3px 3px", background: "rgba(11,7,32,0.88)", boxShadow: "0 0 0 4px rgba(103,232,249,0.7)" }} />
    </div>
  );
}

/**
 * A ring of objects seen from above while the light circles them, so every shadow
 * sweeps round like a sundial. Then the end card, and a fade to black for the loop.
 */
export const EndCard = () => {
  const frame = useCurrentFrame();
  const move = { ...clamp, easing: Easing.bezier(...glide) };
  const lightAz = interpolate(frame, [0, 180], [-30, 110]);
  const card = interpolate(frame, [58, 96], [0, 1], { ...clamp, easing: Easing.bezier(...ease) });
  const logo = useFade(60, 24);
  const line = useFade(96, 24);
  const button = useFade(110, 24);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig
          position={orbit(CENTER, 31, interpolate(frame, [0, 180], [-20, 25]), interpolate(frame, [0, 180], [86, 62], move))}
          target={CENTER}
          fov={34}
        />
        <Fill />
        <KeyLight position={orbit(CENTER, 15, lightAz, 38)} target={CENTER} angle={0.62} intensity={1.1} />
        <Cyclorama />
        <ShadowObject model="chair" grounded clay={1} size={SIZE} position={place(0)} angle={{ azimuth: 20, elevation: 0 }} />
        <ShadowObject model="reindeer" grounded clay={1} size={SIZE} position={place(1)} angle={{ azimuth: -30, elevation: 0 }} />
        <ShadowObject model="astronaut" grounded clay={1} size={SIZE} position={place(2)} angle={{ azimuth: 60, elevation: 0 }} />
        <ShadowObject model="palmTree" grounded clay={1} size={SIZE} position={place(3)} angle={{ azimuth: 0, elevation: 0 }} />
        <ShadowObject model="snowman" grounded clay={1} size={SIZE} position={place(4)} angle={{ azimuth: 30, elevation: 0 }} />
        <ShadowObject model="floorLamp" grounded clay={1} size={SIZE} position={place(5)} angle={{ azimuth: 0, elevation: 0 }} />
        <ShadowObject model="pottedPlant" grounded clay={1} size={SIZE} position={place(6)} angle={{ azimuth: 0, elevation: 0 }} />
      </StageCanvas>

      {/* The scene recedes behind the card. */}
      <AbsoluteFill style={{ backgroundColor: "rgba(8,6,26,0.72)", opacity: card, backdropFilter: `blur(${card * 14}px)` }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ opacity: logo.opacity, translate: `0px ${logo.rise}px` }}>
          <Logo />
        </div>
        <RevealText
          text="Shadow Guess"
          start={68}
          stagger={5}
          duration={26}
          style={{ marginTop: 36, fontFamily: displayFont, fontSize: 150, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.045em", color: colors.text }}
        />
        <div style={{ marginTop: 26, fontFamily: bodyFont, fontSize: 42, color: colors.muted, opacity: line.opacity, translate: `0px ${line.rise}px` }}>
          Can you name it from its shadow?
        </div>
        <div
          style={{
            marginTop: 54,
            padding: "26px 60px",
            borderRadius: 999,
            backgroundImage: accentGradient,
            boxShadow: "0 20px 60px -20px rgba(236,72,153,0.8), inset 0 1px 0 rgba(255,255,255,0.25)",
            fontFamily: bodyFont,
            fontSize: 36,
            fontWeight: 600,
            color: "white",
            opacity: button.opacity,
            translate: `0px ${button.rise}px`,
          }}
        >
          Play today&rsquo;s daily
        </div>
      </AbsoluteFill>

      <FadeBlack from={152} to={179} reverse />
    </AbsoluteFill>
  );
};
