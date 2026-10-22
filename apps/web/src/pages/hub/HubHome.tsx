// GameHub's front page: a sunrise over paper, the lineup as a reel, the daily loop drawn as
// you scroll, three ways to play, and today's dailies. One rAF loop (./scroll) drives every
// scroll-linked section; each game's own landing page opens from the reel.
import { useEffect } from "react";
import { DayRoute } from "./DayRoute";
import { Lineup } from "./Lineup";
import { startScroll, useReducedMotion } from "./scroll";
import { Sunrise } from "./Sunrise";
import { Today } from "./Today";
import { WaysToPlay } from "./WaysToPlay";

export default function HubHome() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Sunrise reduced={reduced} />
      <Lineup />
      <DayRoute />
      <WaysToPlay />
      <Today />
    </>
  );
}
