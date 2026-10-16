// What the HUD shows, mirrored from the simulation and the aim (which live outside React).
import { create } from "zustand";

interface HuntState {
  /** The placed prop under the crosshair and within reach, if any. */
  aimed: number | null;
  /** The kind you've become, or null as yourself. */
  disguise: string | null;
  locked: boolean;
  /** The room you're in ("Kitchen"), and whether that's upstairs or outside. */
  area: string | null;
  level: "ground floor" | "first floor" | "outside";
  /** Out of the round: the player we're watching. */
  watching: string | null;
}

export const useHunt = create<HuntState>(() => ({ aimed: null, disguise: null, locked: false, area: null, level: "ground floor", watching: null }));
