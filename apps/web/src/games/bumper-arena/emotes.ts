// Emotes: Wave, Laugh, Taunt and Cry on keys 1–4 (or the emote button on tablets). In a party
// room they go through the room to everyone; on your own they just play. A rider plays the
// clip with the icon over its name for a moment, and out players can emote too. Bots laugh
// now and then when they knock someone out.
import { BUMPER_EMOTE_COOLDOWN_MS, type BumperEmote } from "@shadow/shared";
import { play, type Sound } from "../../lib/sound";
import { sendBumper } from "./room";
import { game, ME, onBumperEvent, pushFeed, useBumper } from "./store";

export const EMOTES: Record<BumperEmote, { name: string; icon: string; clip: string; sound: Sound }> = {
  wave: { name: "Wave", icon: "👋", clip: "interact-right", sound: "squeak" },
  laugh: { name: "Laugh", icon: "😂", clip: "emote-yes", sound: "kazoo" },
  taunt: { name: "Taunt", icon: "😤", clip: "attack-melee-right", sound: "honk" },
  cry: { name: "Cry", icon: "😭", clip: "emote-no", sound: "trombone" },
};

/** How long an emote shows (ms). */
const SHOW_MS = 1500;
const shown = new Map<string, { emote: BumperEmote; at: number }>();
let lastMine = 0;

/** The emote a ring is showing right now, if any. */
export function emoteOf(id: string): BumperEmote | null {
  const e = shown.get(id);
  return e && performance.now() - e.at < SHOW_MS ? e.emote : null;
}

/** Shows an emote on a ring, and plays its sound (others' quieter, from where they are). */
export function showEmote(id: string, emote: BumperEmote) {
  shown.set(id, { emote, at: performance.now() });
  const me = game.sim?.ring(ME);
  const r = game.sim?.ring(id);
  // Out of the round, so off screen: the feed carries it.
  if (r && r.state !== "in") {
    const name = id === ME ? "You" : useBumper.getState().entrants.find((x) => x.id === id)?.name;
    if (name) pushFeed(`${name} ${EMOTES[emote].icon}`);
  }
  if (id === ME || !r) return play(EMOTES[emote].sound, 0.7);
  const [cx, cz] = me && me.state === "in" ? [me.x, me.z] : [0, 0];
  play(EMOTES[emote].sound, 0.5, { volume: Math.max(0.15, 1 - Math.hypot(r.x - cx, r.z - cz) / 18), pan: (r.x - cx) / 12 });
}

/** Our own emote: shown at once, and sent to the room in a party. */
export function emote(e: BumperEmote) {
  const { mode, backdrop } = useBumper.getState();
  if (backdrop || mode === "menu") return;
  const now = performance.now();
  if (now - lastMine < BUMPER_EMOTE_COOLDOWN_MS) return;
  lastMine = now;
  showEmote(ME, e);
  if (mode === "party") sendBumper({ type: "emote", emote: e });
}

onBumperEvent((e, sim) => {
  if (e.type !== "out" || !e.by || !sim.ring(e.by)?.bot || Math.random() > 0.5) return;
  const by = e.by;
  setTimeout(() => game.sim === sim && showEmote(by, "laugh"), 400);
});
