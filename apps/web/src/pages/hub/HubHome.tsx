// GameHub's front page, on night: every game on the first screen, lit in its own colour,
// then the daily loop drawn as you scroll, three ways to play, and today's dailies. One rAF
// loop (./scroll) drives the scroll-linked section; each game's own landing page opens from
// its card.
import { useEffect } from "react";
import { DayRoute } from "./DayRoute";
import { Hero } from "./Hero";
import { startScroll, useReducedMotion } from "./scroll";
import { Today } from "./Today";
import { WaysToPlay } from "./WaysToPlay";

export default function HubHome() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Hero />
      <DayRoute />
      <WaysToPlay />
      <Today />
    </>
  );
}
