// Live climbs: everyone climbing today's tower right now, over a Supabase Realtime channel.
// Presence says who is there (name and avatar); broadcasts carry positions a few times a
// second, drawn a moment late so they can be smoothly blended. Nothing touches the database.
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { GHOST_POSES, type AvatarConfig, type GhostFrame } from "@shadow/shared";
import { supabase } from "../../lib/supabase";
import { blendFrames } from "./ghosts";

/** How often to send this climber's position, in seconds. */
export const LIVE_SEND_EVERY = 0.25;
/** Draw others this far in the past, so there are two positions to blend between. */
const DELAY_MS = 400;
/** Not heard from in this long: hidden until they move again. */
const STALE_MS = 5000;
/** Climbers drawn at once, to keep the scene light. */
export const LIVE_MAX = 8;

export const liveAvailable = supabase !== null;

export interface LiveRider {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  /** Newest last. */
  buffer: { at: number; frame: GhostFrame }[];
}

interface Who {
  name: string;
  avatar: AvatarConfig;
}

/** Packed position: x, y, z in cm, facing in 1/256 turns, pose index. Rooms send the same. */
export type PackedFrame = [number, number, number, number, number];
type Packet = { id: string; p: PackedFrame };

export function packFrame(f: GhostFrame): PackedFrame {
  const turn = f.facing / (Math.PI * 2);
  return [Math.round(f.x * 100), Math.round(f.y * 100), Math.round(f.z * 100), Math.round((turn - Math.floor(turn)) * 256) & 255, GHOST_POSES.indexOf(f.pose)];
}

/** Adds a packed position, just received, to a rider's buffer. */
export function pushPacked(rider: LiveRider, p: PackedFrame) {
  const [x, y, z, facing, pose] = p ?? [];
  if (!GHOST_POSES[pose]) return;
  rider.buffer.push({
    at: performance.now(),
    frame: { x: x / 100, y: y / 100, z: z / 100, facing: (facing / 256) * Math.PI * 2, pose: GHOST_POSES[pose] },
  });
  if (rider.buffer.length > 12) rider.buffer.shift();
}

const riders = new Map<string, LiveRider>();
let list: LiveRider[] = [];
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
const myId = Math.random().toString(36).slice(2, 12);

function changed() {
  list = [...riders.values()];
  for (const l of listeners) l();
}

/** The climbers on the tower right now (not this one). */
export function useLiveRiders(): LiveRider[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => list,
  );
}

export function joinLive(seed: string, who: Who) {
  leaveLive();
  if (!supabase) return;
  const ch = supabase.channel(`sky-climb:${seed}`, { config: { broadcast: { self: false }, presence: { key: myId } } });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<Who>();
    for (const id of riders.keys()) if (!state[id]) riders.delete(id);
    for (const [id, metas] of Object.entries(state)) {
      if (id === myId || !metas[0]) continue;
      const rider = riders.get(id);
      if (rider) Object.assign(rider, { name: metas[0].name, avatar: metas[0].avatar });
      else riders.set(id, { id, name: metas[0].name, avatar: metas[0].avatar, buffer: [] });
    }
    changed();
  });
  ch.on("broadcast", { event: "pos" }, ({ payload }: { payload: Packet }) => {
    const rider = riders.get(payload.id);
    if (rider) pushPacked(rider, payload.p);
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") void ch.track(who);
  });
  channel = ch;
}

export function leaveLive() {
  if (channel) void supabase?.removeChannel(channel);
  channel = null;
  if (riders.size) {
    riders.clear();
    changed();
  }
}

/** Shares this climber's position with the others on the tower. */
export function sendLive(f: GhostFrame) {
  if (!channel) return;
  const packet: Packet = { id: myId, p: packFrame(f) };
  void channel.send({ type: "broadcast", event: "pos", payload: packet });
}

/**
 * Where a live climber is now (a moment ago, really); false while they can't be shown.
 * `delayMs` should cover about two sends, so there are always two positions to blend.
 */
export function sampleLive(rider: LiveRider, out: GhostFrame, delayMs = DELAY_MS): boolean {
  const b = rider.buffer;
  const now = performance.now();
  if (!b.length || now - b[b.length - 1].at > STALE_MS) return false;
  const at = now - delayMs;
  // Hold the newest position once it's older than the delay, the oldest until it's due.
  if (b[b.length - 1].at <= at) {
    Object.assign(out, b[b.length - 1].frame);
    return true;
  }
  let i = b.length - 1;
  while (i > 0 && b[i - 1].at > at) i--;
  if (i === 0) {
    Object.assign(out, b[0].frame);
    return true;
  }
  const a = b[i - 1];
  blendFrames(a.frame, b[i].frame, (at - a.at) / (b[i].at - a.at), out);
  return true;
}
