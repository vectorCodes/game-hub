import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BEAT } from "../beats";
import { CameraRig, Cyclorama, Fill, ShadowObject, StageCanvas, SunLight, WALL_Z } from "../stage/Stage";
import { Slam, Vignette } from "../stage/Type";
import { bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SPACING = 6;

/** 16–20 s: the camera races along a wall of shadows. */
export const Lineup = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 120], [-22, 22], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const at = (i: number): [number, number, number] => [(i - 3.5) * SPACING, 0, 0];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <StageCanvas>
        {/* The camera leads its target a little, so the wall slides past at an angle. */}
        <CameraRig position={[x - 3, 0.4, 11]} target={[x + 1, -0.4, WALL_Z]} fov={34} />
        <Fill />
        <SunLight halfWidth={28} />
        <Cyclorama />
        <ShadowObject model="snowman" position={at(0)} angle={{ azimuth: 0, elevation: 0 }} size={3.6} />
        <ShadowObject model="floorLamp" position={at(1)} angle={{ azimuth: 0, elevation: 0 }} size={3.6} />
        <ShadowObject model="iceCream" position={at(2)} angle={{ azimuth: 0, elevation: 0 }} size={3.6} />
        <ShadowObject model="palmTree" position={at(3)} angle={{ azimuth: 60, elevation: 0 }} size={3.6} />
        <ShadowObject model="chair" position={at(4)} angle={{ azimuth: 90, elevation: 0 }} size={3.6} />
        <ShadowObject model="pottedPlant" position={at(5)} angle={{ azimuth: 0, elevation: 0 }} size={3.6} />
        <ShadowObject model="reindeer" position={at(6)} angle={{ azimuth: 90, elevation: 0 }} size={3.6} />
        <ShadowObject model="astronaut" position={at(7)} angle={{ azimuth: 20, elevation: 0 }} size={3.6} />
      </StageCanvas>
      <Vignette strength={0.6} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, transparent 45%, rgba(14,20,17,0.85) 100%)" }} />

      <AbsoluteFill style={{ justifyContent: "flex-end", paddingLeft: 140, paddingBottom: 110 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <Slam at={0} style={{ fontFamily: displayFont, fontSize: 210, fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.05em", color: colors.text }}>
            80+
          </Slam>
          <Slam at={BEAT} style={{ fontFamily: displayFont, fontSize: 96, fontWeight: 600, letterSpacing: "-0.04em", color: colors.text }}>
            objects.
          </Slam>
        </div>
        <Slam at={BEAT * 4} from={1.1} style={{ marginTop: 14, fontFamily: bodyFont, fontSize: 40, color: colors.muted }}>
          Furniture, food, festive, far-out.
        </Slam>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
