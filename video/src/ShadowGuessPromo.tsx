import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Open } from "./scenes/Open";
import { Reveal } from "./scenes/Reveal";
import { Play } from "./scenes/Play";
import { Gallery } from "./scenes/Gallery";
import { EndCard } from "./scenes/EndCard";

/** Starts and ends on black so it loops cleanly on the homepage. */
export const ShadowGuessPromo = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Open" durationInFrames={150}>
        <Open />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />
      <TransitionSeries.Sequence name="Reveal" durationInFrames={180}>
        <Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />
      <TransitionSeries.Sequence name="Play" durationInFrames={300}>
        <Play />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />
      <TransitionSeries.Sequence name="Gallery" durationInFrames={180}>
        <Gallery />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />
      <TransitionSeries.Sequence name="End card" durationInFrames={180}>
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
