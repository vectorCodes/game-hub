import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { ShadowGuessCover, ShadowGuessStatus } from "./shadow-guess/HubCard";
import { SkyClimbCover, SkyClimbStatus } from "./sky-climb/HubCard";
import { PuttIslesCover, PuttIslesStatus } from "./putt-isles/HubCard";

export interface GameEntry {
  id: string;
  title: string;
  /** For the header on phones. */
  shortTitle: string;
  tagline: string;
  /** The game's landing page. The game itself is at `${path}/play`. */
  path: string;
  /** Lazy so each game's pages (and three.js) load only when they're opened. */
  Landing: LazyExoticComponent<ComponentType>;
  Component: LazyExoticComponent<ComponentType>;
  /** Art for the game's tile on the GameHub page. Loaded eagerly: keep it light. */
  Cover: ComponentType;
  /** One line of live status for the tile ("Daily #3 is live"). */
  Status: ComponentType;
}

export const playPath = (game: GameEntry) => `${game.path}/play`;

export const games: GameEntry[] = [
  {
    id: "shadow-guess",
    title: "Shadow Guess",
    shortTitle: "Shadow",
    tagline: "Name the object from its shadow. Every miss turns the light.",
    path: "/games/shadow-guess",
    Landing: lazy(() => import("../pages/ShadowGuessHome")),
    Component: lazy(() => import("./shadow-guess/ShadowGuessPage")),
    Cover: ShadowGuessCover,
    Status: ShadowGuessStatus,
  },
  {
    id: "sky-climb",
    title: "Sky Climb",
    shortTitle: "Climb",
    tagline: "One tower a day. Jump from meadow to storm to the stars. Don't look down.",
    path: "/games/sky-climb",
    Landing: lazy(() => import("./sky-climb/SkyClimbHome")),
    Component: lazy(() => import("./sky-climb/SkyClimbPage")),
    Cover: SkyClimbCover,
    Status: SkyClimbStatus,
  },
  {
    id: "putt-isles",
    title: "Putt Isles",
    shortTitle: "Putt",
    tagline: "Mini-golf on floating islands. Bank it, ride the hills, sink it.",
    path: "/games/putt-isles",
    Landing: lazy(() => import("./putt-isles/PuttIslesHome")),
    Component: lazy(() => import("./putt-isles/PuttIslesPage")),
    Cover: PuttIslesCover,
    Status: PuttIslesStatus,
  },
];
