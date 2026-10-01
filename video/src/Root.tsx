import "./index.css";
import { Composition, Folder } from "remotion";
import { ShadowGuessPromo } from "./ShadowGuessPromo";
import { Hook } from "./scenes/Hook";
import { Title } from "./scenes/Title";
import { Round } from "./scenes/Round";
import { Lineup } from "./scenes/Lineup";
import { Angles } from "./scenes/Angles";
import { Daily } from "./scenes/Daily";
import { Speed } from "./scenes/Speed";
import { Finale } from "./scenes/Finale";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 120 + 120 + 240 + 120 + 120 + 120 + 240 + 270 = 1350 frames = 45 s */}
      <Composition id="ShadowGuessPromo" component={ShadowGuessPromo} durationInFrames={1350} fps={30} width={1920} height={1080} />
      <Folder name="ShadowGuessPromo-Scenes">
        <Composition id="Hook" component={Hook} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Title" component={Title} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Round" component={Round} durationInFrames={240} fps={30} width={1920} height={1080} />
        <Composition id="Lineup" component={Lineup} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Angles" component={Angles} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Daily" component={Daily} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Speed" component={Speed} durationInFrames={240} fps={30} width={1920} height={1080} />
        <Composition id="Finale" component={Finale} durationInFrames={270} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
