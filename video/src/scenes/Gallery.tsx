import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CameraRig, Cyclorama, Fill, KeyLight, orbit, ShadowObject, StageCanvas, track, WALL_Z } from "../stage/Stage";
import { RevealText, useFade } from "../stage/Type";
import { bodyFont, colors, displayFont, glide } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PANEL_W = 500;
const PANEL_H = 600;

/** A rounded window onto its own small stage. */
function Panel({ delay, label, children }: { delay: number; label: string; children: ReactNode }) {
  const { opacity, rise } = useFade(delay, 26);
  return (
    <div style={{ opacity, translate: `0px ${rise * 1.6}px` }}>
      <div
        style={{
          position: "relative",
          width: PANEL_W,
          height: PANEL_H,
          overflow: "hidden",
          borderRadius: 28,
          border: `1px solid ${colors.hairline}`,
          boxShadow: "0 40px 100px -50px rgba(0,0,0,0.9)",
        }}
      >
        <StageCanvas width={PANEL_W} height={PANEL_H}>
          {children}
        </StageCanvas>
      </div>
      <div style={{ marginTop: 20, fontFamily: bodyFont, fontSize: 22, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>
        {label}
      </div>
    </div>
  );
}

/** Three objects, three camera angles, side by side. */
export const Gallery = () => {
  const frame = useCurrentFrame();
  const move = { ...clamp, easing: Easing.bezier(...glide) };
  const sub = useFade(70, 24);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night, alignItems: "center" }}>
      <div style={{ marginTop: 110, textAlign: "center" }}>
        <RevealText
          text="80+ objects. Six angles each."
          start={4}
          stagger={4}
          style={{ fontFamily: displayFont, fontSize: 92, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05, color: colors.text }}
        />
        <div style={{ marginTop: 18, fontFamily: bodyFont, fontSize: 38, color: colors.muted, opacity: sub.opacity, translate: `0px ${sub.rise}px` }}>
          A new puzzle every day.
        </div>
      </div>

      <div style={{ display: "flex", gap: 30, marginTop: 56 }}>
        <Panel delay={16} label="LOW ANGLE">
          <CameraRig
            position={track(frame, [0, 180], [-1.8, -4.8, 10], [-0.6, -3, 11.5])}
            target={[0, 0.8, WALL_Z]}
            fov={40}
          />
          <Fill />
          <KeyLight />
          <Cyclorama />
          <ShadowObject model="palmTree" angle={{ azimuth: interpolate(frame, [0, 180], [10, 45], move), elevation: 0 }} />
        </Panel>
        <Panel delay={24} label="OVERHEAD">
          <CameraRig
            position={orbit([0, -0.5, -1.5], 19, interpolate(frame, [0, 180], [-30, 10], move), 30)}
            target={[0, -0.4, -3]}
            fov={36}
          />
          <Fill />
          <KeyLight />
          <Cyclorama />
          <ShadowObject model="iceCream" angle={{ azimuth: interpolate(frame, [0, 180], [0, 40], move), elevation: 0 }} clay={1} />
        </Panel>
        <Panel delay={32} label="PUSH IN">
          <CameraRig
            position={track(frame, [0, 180], [0, 0, 17], [0.2, 0.2, 10.5])}
            target={[0, -0.2, WALL_Z]}
            fov={interpolate(frame, [0, 180], [30, 38], move)}
          />
          <Fill />
          <KeyLight />
          <Cyclorama />
          <ShadowObject model="cactus" angle={{ azimuth: interpolate(frame, [0, 180], [-20, 20], move), elevation: 0 }} />
        </Panel>
      </div>
    </AbsoluteFill>
  );
};
