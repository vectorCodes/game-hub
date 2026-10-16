// The other players in a match, as the room reports them: where they are (buffered, to be
// drawn a moment behind and blended), what they've become, and their taunts. Also what we
// send: our position ten times a second, our disguise, our taunts. And the match's rules for
// us: in a match only a hider still hiding may become a prop.
//
// To a seeker, a hider who hasn't been found is only a tag (the server's doing); once found,
// they come back under their real id, and they're out: gone from the house, watching the others.
import { useSyncExternalStore } from "react";
import { HUNT_POSES, HUNT_POS_HZ, type HuntPos, type HuntPose, type HuntRole, type HuntServerMessage, type HuntStatus, type HuntView } from "@shadow/shared";
import { onHuntMessage, sendHunt, toLocalTime } from "./room";

export interface Frame {
  /** Local time it arrived (ms, performance.now). */
  t: number;
  x: number;
  y: number;
  z: number;
  facing: number;
  pose: HuntPose;
  locked: boolean;
}

export interface Remote {
  /** A player id, or a hider's tag (to seekers). */
  id: string;
  frames: Frame[];
  /** The prop kind they've become, or null as themselves. */
  kind: string | null;
}

/** Drawn this far behind, so there are two positions (sent 10 a second) to blend. */
export const REMOTE_DELAY_MS = 200;
/** No position for this long: they're gone (left, or blindfolded us). */
const STALE_MS = 3000;
/** Further than this between two positions: a teleport (a spawn), not a walk. */
const TELEPORT = 4;
const MAX_FRAMES = 30;

const remotes = new Map<string, Remote>();
let ids: string[] = [];
const idListeners = new Set<() => void>();

/** Hiders caught undisguised when seeking began: shown to everyone until then (local ms). */
const exposed = new Map<string, number>();
const EXPOSED_MS = 5000;
export const isExposed = (id: string) => (exposed.get(id) ?? 0) > performance.now();

type TauntListener = (id: string, sound: number, forced: boolean) => void;
const tauntListeners = new Set<TauntListener>();
/** Our own taunts that the room forced (the last minute): we didn't press anything, so we're told. */
const forcedListeners = new Set<(sound: number) => void>();
const sonarListeners = new Set<(dir: [number, number]) => void>();

/** The match as it stands, for the rules and for what we send. */
const match = {
  /** Hiding or seeking: we're in the house with the others. */
  on: false,
  status: null as HuntStatus | null,
  you: null as string | null,
  role: null as HuntRole | null,
  canDisguise: true,
  /** Found: out until the next round, watching the others. */
  spectating: false,
  /** Can't move: everyone before hiding starts, seekers while the hiders hide. */
  frozen: false,
  /** Local time (ms) a dizzy seeker can zap again. */
  dizzyUntil: 0,
  /** Everyone we know to be a seeker (zapping one is pointless). */
  seekers: new Set<string>(),
};

function changed() {
  const next = [...remotes.keys()];
  if (next.length === ids.length && next.every((id, i) => id === ids[i])) return;
  ids = next;
  for (const l of idListeners) l();
}

function remote(id: string) {
  let r = remotes.get(id);
  if (!r) {
    remotes.set(id, (r = { id, frames: [], kind: null }));
    changed();
  }
  return r;
}

export function clearRemotes() {
  remotes.clear();
  changed();
}

/** The ids of everyone else in view, for React to draw one component each. */
export function useRemoteIds(): string[] {
  return useSyncExternalStore(
    (l) => {
      idListeners.add(l);
      return () => void idListeners.delete(l);
    },
    () => ids,
  );
}

export const getRemote = (id: string) => remotes.get(id);
export const allRemotes = () => remotes.values();

export function onRemoteTaunt(l: TauntListener) {
  tauntListeners.add(l);
  return () => void tauntListeners.delete(l);
}

export function onForcedTaunt(l: (sound: number) => void) {
  forcedListeners.add(l);
  return () => void forcedListeners.delete(l);
}

export function onSonar(l: (dir: [number, number]) => void) {
  sonarListeners.add(l);
  return () => void sonarListeners.delete(l);
}

export const inMatch = () => match.on;
/** In a match, only a hider who's still hiding may be a prop; outside one, anyone may. */
export const mayDisguise = () => !match.on || match.canDisguise;
export const isFrozen = () => match.frozen;
export const isSpectating = () => match.spectating;
/** A seeker, while seeking: clicks zap. */
export const mayZap = () => match.status === "seek" && match.role === "seeker";
export const isDizzy = () => performance.now() < match.dizzyUntil;
export const isSeeker = (id: string) => match.seekers.has(id);

/** Keeps the rules in step with the room; called whenever the room changes. */
export function syncMatch(room: HuntView | null, you: string | null) {
  const status = room?.status ?? null;
  const on = status === "hide" || status === "seek";
  const me = room?.players.find((p) => p.id === you);
  match.on = on;
  match.status = status;
  match.you = you;
  match.role = me?.role ?? null;
  match.canDisguise = on && me?.role === "hider" && !me.found;
  match.spectating = on && me?.role === "hider" && me.found;
  match.frozen = status === "countdown" || (status === "hide" && me?.role === "seeker");
  // Server time to ours; performance.now and Date.now differ only by a constant.
  match.dizzyUntil = me?.dizzyUntil ? performance.now() + (toLocalTime(me.dizzyUntil) - Date.now()) : 0;
  match.seekers = new Set(room?.players.filter((p) => p.role === "seeker").map((p) => p.id));
  if (!on) clearRemotes();
}

function unpack(p: HuntPos): Omit<Frame, "t"> {
  return { x: p[0] / 100, y: p[1] / 100, z: p[2] / 100, facing: (p[3] / 256) * Math.PI * 2, pose: HUNT_POSES[p[4]] ?? "idle", locked: (p[5] & 1) === 1 };
}

onHuntMessage((msg: HuntServerMessage) => {
  switch (msg.type) {
    case "pos": {
      if (!match.on || msg.id === match.you) return;
      const r = remote(msg.id);
      r.frames.push({ t: performance.now(), ...unpack(msg.p) });
      if (r.frames.length > MAX_FRAMES) r.frames.splice(0, r.frames.length - MAX_FRAMES);
      break;
    }
    case "disguised":
      if (msg.id !== match.you) remote(msg.id).kind = msg.kind;
      break;
    case "found":
      // A found hider is out: gone from the house. (One taking over from seekers who all left
      // comes back under their real id, as themselves.)
      if (remotes.delete(msg.tag)) changed();
      if (msg.by && remotes.delete(msg.id)) changed();
      else if (remotes.has(msg.id)) remotes.get(msg.id)!.kind = null;
      break;
    case "exposed":
      for (const id of msg.ids) exposed.set(id, performance.now() + EXPOSED_MS);
      break;
    case "taunt":
      if (msg.id !== match.you) for (const l of tauntListeners) l(msg.id, msg.sound, msg.forced);
      else if (msg.forced) for (const l of forcedListeners) l(msg.sound);
      break;
    case "sonar":
      for (const l of sonarListeners) l(msg.dir);
      break;
  }
});

/** Drops anyone we haven't heard from in a while. */
export function pruneRemotes(now: number) {
  let gone = false;
  for (const [id, r] of remotes) {
    const last = r.frames.at(-1);
    if (last && now - last.t > STALE_MS) {
      remotes.delete(id);
      gone = true;
    }
  }
  if (gone) changed();
}

/** Where a remote player is, `REMOTE_DELAY_MS` ago, blended between the two positions around then. */
export function sampleRemote(r: Remote, now: number, out: Frame): boolean {
  const f = r.frames;
  if (f.length === 0) return false;
  const at = now - REMOTE_DELAY_MS;
  let i = f.length - 1;
  while (i > 0 && f[i - 1].t > at) i--;
  const b = f[i];
  const a = i > 0 ? f[i - 1] : b;
  if (a === b || at >= b.t) {
    Object.assign(out, b);
    return true;
  }
  const k = Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t || 1)));
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > TELEPORT) {
    Object.assign(out, k < 0.5 ? a : b);
    return true;
  }
  let d = (b.facing - a.facing) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  Object.assign(out, {
    t: at,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    facing: a.facing + d * k,
    pose: k < 0.5 ? a.pose : b.pose,
    locked: b.locked,
  });
  return true;
}

// ---------- What we send ----------

/** Seconds between position sends. */
export const SEND_EVERY = 1 / HUNT_POS_HZ;

export function sendPosition(x: number, y: number, z: number, facing: number, pose: HuntPose, locked: boolean) {
  const turn = Math.round((((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 256) % 256;
  sendHunt({ type: "pos", p: [Math.round(x * 100), Math.round(y * 100), Math.round(z * 100), turn, Math.max(0, HUNT_POSES.indexOf(pose)), locked ? 1 : 0] });
}

export const sendDisguise = (prop: number | null) => sendHunt({ type: "disguise", prop });
export const sendZap = (target: string | null, at: [number, number, number]) =>
  sendHunt({ type: "zap", target, at: [Math.round(at[0] * 100), Math.round(at[1] * 100), Math.round(at[2] * 100)] });
export const sendTaunt = () => sendHunt({ type: "taunt" });
export const sendSonar = () => sendHunt({ type: "sonar" });
