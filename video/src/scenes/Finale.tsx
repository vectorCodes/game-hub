import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BAR, BEAT, hit, snap } from "../beats";
import { CameraRig, Cyclorama, Fill, FLOOR_Y, KeyLight, orbit, ShadowObject, StageCanvas, type Vec3 } from "../stage/Stage";
import { FadeBlack, RevealText, Slam } from "../stage/Type";
import { accentGradient, bodyFont, colors, displayFont, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CENTER: Vec3 = [0, FLOOR_Y, 5];
const RING = 5.6;
const SIZE = 2.4;
/** The end card lands on the final hit of the music (40 s). */
const CARD = BAR * 2;

const place = (i: number): Vec3 => {
  const a = ((i + 0.5) / 7) * Math.PI * 2;
  return [CENTER[0] + Math.sin(a) * RING, FLOOR_Y, CENTER[2] + Math.cos(a) * RING];
};

/** The site logo: a lamp and the shadow it casts. */
function Logo() {
  return (
    <div style={{ display: "grid", placeItems: "center", width: 84, height: 84, borderRadius: 24, backgroundImage: accentGradient, boxShadow: "0 0 60px -8px rgba(244,185,78,0.6)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, translate: "3px 3px", background: "rgba(22,32,27,0.92)", boxShadow: "0 0 0 4px rgba(246,243,234,0.6)" }} />
    </div>
  );
}

/** 36–45 s: shadows sweep round a ring like sundials, then the end card and a fade for the loop. */
export const Finale = () => {
  const frame = useCurrentFrame();
  const move = { ...clamp, easing: Easing.bezier(...glide) };
  const card = interpolate(frame, [CARD - 6, CARD + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const punch = hit(frame, CARD, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig
          position={orbit(CENTER, 31, interpolate(frame, [0, 270], [-30, 40]), interpolate(frame, [0, CARD], [88, 58], move))}
          target={CENTER}
          fov={34}
        />
        <Fill />
        <KeyLight position={orbit(CENTER, 15, interpolate(frame, [0, 270], [-40, 200]), 36)} target={CENTER} angle={0.62} intensity={1.1} />
        <Cyclorama />
        <ShadowObject model="chair" grounded clay={1} size={SIZE} position={place(0)} angle={{ azimuth: 20, elevation: 0 }} />
        <ShadowObject model="reindeer" grounded clay={1} size={SIZE} position={place(1)} angle={{ azimuth: -30, elevation: 0 }} />
        <ShadowObject model="astronaut" grounded clay={1} size={SIZE} position={place(2)} angle={{ azimuth: 60, elevation: 0 }} />
        <ShadowObject model="palmTree" grounded clay={1} size={SIZE} position={place(3)} angle={{ azimuth: 0, elevation: 0 }} />
        <ShadowObject model="snowman" grounded clay={1} size={SIZE} position={place(4)} angle={{ azimuth: 30, elevation: 0 }} />
        <ShadowObject model="floorLamp" grounded clay={1} size={SIZE} position={place(5)} angle={{ azimuth: 0, elevation: 0 }} />
        <ShadowObject model="pottedPlant" grounded clay={1} size={SIZE} position={place(6)} angle={{ azimuth: 0, elevation: 0 }} />
      </StageCanvas>

      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}>
        <Slam
          at={BEAT * 2}
          until={CARD - 4}
          style={{ padding: "20px 44px", borderRadius: 999, background: "rgba(14,20,17,0.8)", border: `1px solid ${colors.hairline}`, fontFamily: displayFont, fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em", color: colors.text }}
        >
          One shadow. Every day.
        </Slam>
      </AbsoluteFill>

      {/* The scene recedes behind the card. */}
      <AbsoluteFill style={{ backgroundColor: "rgba(14,20,17,0.74)", opacity: card, backdropFilter: `blur(${card * 14}px)` }} />

      {frame >= CARD - 2 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", scale: String(1 + punch * 0.04) }}>
          <div style={{ opacity: snap(frame, CARD, 10), scale: String(0.7 + 0.3 * snap(frame, CARD, 14)) }}>
            <Logo />
          </div>
          <RevealText
            text="Shadow Guess"
            start={CARD + 4}
            stagger={4}
            duration={16}
            style={{ marginTop: 36, fontFamily: displayFont, fontSize: 160, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.045em", color: colors.text }}
          />
          <Slam at={CARD + BEAT * 2} from={1.08} style={{ marginTop: 26, fontFamily: bodyFont, fontSize: 44, color: colors.muted }}>
            Can you name it from its shadow?
          </Slam>
          <Slam
            at={CARD + BEAT * 3}
            from={1.2}
            style={{
              marginTop: 50,
              padding: "26px 62px",
              borderRadius: 999,
              backgroundImage: accentGradient,
              boxShadow: "0 20px 60px -20px rgba(233,160,58,0.7), inset 0 1px 0 rgba(255,255,255,0.25)",
              fontFamily: bodyFont,
              fontSize: 38,
              fontWeight: 600,
              color: colors.ink,
            }}
          >
            Play today&rsquo;s daily · it&rsquo;s free
          </Slam>
        </AbsoluteFill>
      )}

      <FadeBlack from={240} to={269} reverse />
    </AbsoluteFill>
  );
};
