import "./index.css";
import { Composition, Folder } from "remotion";
import { ShadowGuessPromo } from "./ShadowGuessPromo";
import { Open } from "./scenes/Open";
import { Reveal } from "./scenes/Reveal";
import { Play } from "./scenes/Play";
import { Gallery } from "./scenes/Gallery";
import { EndCard } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 150 + 180 + 300 + 180 + 180 − 4 × 20 crossfade overlap */}
      <Composition id="ShadowGuessPromo" component={ShadowGuessPromo} durationInFrames={910} fps={30} width={1920} height={1080} />
      <Folder name="ShadowGuessPromo-Scenes">
        <Composition id="Open" component={Open} durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition id="Reveal" component={Reveal} durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="Play" component={Play} durationInFrames={300} fps={30} width={1920} height={1080} />
        <Composition id="Gallery" component={Gallery} durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="EndCard" component={EndCard} durationInFrames={180} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
