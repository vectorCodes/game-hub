import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BEAT, hit, snap } from "../beats";
import type { ModelName } from "../stage/models";
import { CameraRig, Cyclorama, Fill, KeyLight, orbit, ShadowObject, StageCanvas, type LightAngle } from "../stage/Stage";
import { Slam, Vignette } from "../stage/Type";
import { accentGradient, bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const INTRO = BEAT * 2;
const ITEM = BEAT * 2;

/** Shadow on one beat, the answer on the next; every item gets its own camera. */
const ITEMS: { model: ModelName; name: string; angle: LightAngle; cam: [number, number] }[] = [
  { model: "cactus", name: "Cactus", angle: { azimuth: 0, elevation: 0 }, cam: [-28, 6] },
  { model: "snowman", name: "Snowman", angle: { azimuth: 25, elevation: 0 }, cam: [30, 8] },
  { model: "iceCream", name: "Ice cream", angle: { azimuth: 0, elevation: 0 }, cam: [-22, -8] },
  { model: "floorLamp", name: "Floor lamp", angle: { azimuth: 0, elevation: 0 }, cam: [34, 20] },
  { model: "pottedPlant", name: "Potted plant", angle: { azimuth: 0, elevation: 0 }, cam: [-36, 4] },
  { model: "spaceship", name: "Spaceship", angle: { azimuth: 30, elevation: 20 }, cam: [24, 6] },
  { model: "palmTree", name: "Palm tree", angle: { azimuth: 60, elevation: 0 }, cam: [-30, 14] },
];

/** 28–36 s: guess along, one object every two beats. */
export const Speed = () => {
  const frame = useCurrentFrame();
  const intro = frame < INTRO;
  const index = Math.min(ITEMS.length - 1, Math.max(0, Math.floor((frame - INTRO) / ITEM)));
  const start = INTRO + index * ITEM;
  const revealAt = start + BEAT;
  const { model, name, angle, cam } = ITEMS[index];
  const reveal = intro ? 0 : interpolate(frame, [revealAt, revealAt + 4], [0, 1], clamp);
  const light = intro ? 0 : snap(frame, INTRO, 5);
  const local = frame - start;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        <CameraRig
          position={orbit([0, -0.3, -1.5], 15 - (local / ITEM) * 1.2, cam[0] + (local / ITEM) * (cam[0] > 0 ? -4 : 4), cam[1])}
          target={[0, -0.4, -2]}
          fov={32}
        />
        <Fill intensity={light * (1 + reveal * 1.4)} />
        <ambientLight intensity={reveal * 0.45} />
        <KeyLight intensity={light} />
        <Cyclorama />
        {!intro && (
          <group scale={1 + hit(frame, start, 6) * 0.08}>
            <ShadowObject key={model} model={model} angle={angle} reveal={reveal} />
          </group>
        )}
      </StageCanvas>
      <Vignette />

      {intro ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <Slam at={0} style={{ fontFamily: displayFont, fontSize: 170, fontWeight: 700, letterSpacing: "-0.05em", color: colors.text }}>
            Speed round.
          </Slam>
          <Slam at={8} from={1.1} style={{ marginTop: 10, fontFamily: bodyFont, fontSize: 44, color: colors.muted }}>
            Guess before the light comes up.
          </Slam>
        </AbsoluteFill>
      ) : (
        <>
          <div style={{ position: "absolute", top: 90, left: 140, fontFamily: bodyFont, fontSize: 28, fontWeight: 600, letterSpacing: "0.18em", color: colors.muted }}>
            SPEED ROUND · <span style={{ color: colors.text, fontVariantNumeric: "tabular-nums" }}>{index + 1}/7</span>
          </div>
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 }}>
            {frame < revealAt ? (
              <Slam
                key={`q${index}`}
                at={start}
                from={1.2}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 120,
                  height: 120,
                  borderRadius: 999,
                  background: "rgba(14,20,17,0.8)",
                  border: `1px solid ${colors.hairline}`,
                  fontFamily: displayFont,
                  fontSize: 72,
                  fontWeight: 700,
                  color: colors.text,
                }}
              >
                ?
              </Slam>
            ) : (
              <Slam
                key={`a${index}`}
                at={revealAt}
                style={{
                  padding: "18px 48px",
                  borderRadius: 999,
                  background: accentGradient,
                  boxShadow: "0 20px 60px -20px rgba(233,160,58,0.7)",
                  fontFamily: displayFont,
                  fontSize: 76,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: colors.ink,
                }}
              >
                {name}
              </Slam>
            )}
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};
