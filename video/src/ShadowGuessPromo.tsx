import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, Series, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { Hook } from "./scenes/Hook";
import { Title } from "./scenes/Title";
import { Round } from "./scenes/Round";
import { Lineup } from "./scenes/Lineup";
import { Angles } from "./scenes/Angles";
import { Daily } from "./scenes/Daily";
import { Speed } from "./scenes/Speed";
import { Finale } from "./scenes/Finale";

/** Every scene lands with a small push-in, so hard cuts hit like beats. */
function Cut({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 10], [1.045, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return <AbsoluteFill style={{ scale: String(scale) }}>{children}</AbsoluteFill>;
}

/**
 * 45 s at 120 BPM (one beat = 15 frames, one bar = 60). Every cut sits on a bar line,
 * matching public/music.wav (scripts/make-music.mjs). Starts and ends on black for the loop.
 */
export const ShadowGuessPromo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Series>
        <Series.Sequence name="Hook" durationInFrames={120} premountFor={30}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence name="Title" durationInFrames={120} premountFor={30}>
          <Cut>
            <Title />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Round" durationInFrames={240} premountFor={30}>
          <Cut>
            <Round />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Lineup" durationInFrames={120} premountFor={30}>
          <Cut>
            <Lineup />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Angles" durationInFrames={120} premountFor={30}>
          <Cut>
            <Angles />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Daily" durationInFrames={120} premountFor={30}>
          <Cut>
            <Daily />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Speed round" durationInFrames={240} premountFor={30}>
          <Cut>
            <Speed />
          </Cut>
        </Series.Sequence>
        <Series.Sequence name="Finale" durationInFrames={270} premountFor={30}>
          <Cut>
            <Finale />
          </Cut>
        </Series.Sequence>
      </Series>
      <Audio name="Soundtrack" src={staticFile("music.wav")} />
    </AbsoluteFill>
  );
};
