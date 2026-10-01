import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { ShadowGuessHubCard } from "./shadow-guess/HubCard";

export interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  path: string;
  /** Lazy so each game (and three.js) loads only when it's opened. */
  Component: LazyExoticComponent<ComponentType>;
  /** Body of the game's card on the hub (art, status, actions). Loaded eagerly: keep it light. */
  HubCard: ComponentType;
}

export const games: GameEntry[] = [
  {
    id: "shadow-guess",
    title: "Shadow Guess",
    tagline: "Name the object from its shadow. Every miss turns the light.",
    path: "/games/shadow-guess",
    Component: lazy(() => import("./shadow-guess/ShadowGuessPage")),
    HubCard: ShadowGuessHubCard,
  },
];
