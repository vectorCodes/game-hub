// The hunt on screen: the 3-2-1 before a match, the seekers' blindfold while hiders hide, a
// seeker's health, zap, dizziness and sonar, and short announcements as things happen: the
// seekers coming out, finds, hiders caught in the open, the last minute.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HUNT_FORCED_TAUNT, HUNT_HP, HUNT_POINTS, HUNT_SONAR_FROM_SECONDS_LEFT, HUNT_SONAR_SMALL_ROOM, type HuntView } from "@shadow/shared";
import { play } from "../../../lib/sound";
import { actions } from "../input";
import { onSonar } from "../net";
import { onHuntMessage, toLocalTime, useHuntRoom } from "../room";

/** Whole seconds until a server time, ticking on its own. */
function useSecondsLeft(serverMs: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(serverMs === null ? 0 : Math.max(0, Math.ceil((toLocalTime(serverMs) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [serverMs]);
  return left;
}

/** Before the first hide: a big 3, 2, 1, with a tick on each. */
export function Countdown() {
  const { room } = useHuntRoom();
  const left = useSecondsLeft(room?.status === "countdown" ? room.phaseEndsAt : null);
  const on = room?.status === "countdown" && left > 0;
  useEffect(() => {
    if (on) play("tick");
  }, [on, left]);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div key={left} className="animate-pop font-display text-[9rem] leading-none font-bold text-stone-100 drop-shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        {left}
      </div>
    </div>
  );
}

/** Seekers while the hiders hide: a dark screen and the time until the garage door opens. */
export function Blindfold() {
  const { room, you } = useHuntRoom();
  const me = room?.players.find((p) => p.id === you);
  const on = room?.status === "hide" && me?.role === "seeker";
  const left = useSecondsLeft(on ? room!.phaseEndsAt : null);
  if (!on) return null;
  const hiders = room!.players.filter((p) => p.role === "hider" && !p.dnf).length;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#0d0b08]/95 text-center text-stone-200">
      <div>
        <p className="label-mono text-stone-500">Blindfolded in the garage</p>
        <div className="mt-3 font-display text-7xl font-bold tabular-nums">{left}</div>
        <p className="mt-3 max-w-sm px-6 text-stone-400">
          {hiders} {hiders === 1 ? "hider is" : "hiders are"} turning into props somewhere in the house. Listen for taunts when you get out.
        </p>
      </div>
    </div>
  );
}

/** When the sonar unlocks this round (server time): earlier in small rooms, where the house feels empty. */
function sonarFrom(room: HuntView) {
  const players = room.players.filter((p) => !p.dnf).length;
  const seconds = players <= HUNT_SONAR_SMALL_ROOM.players ? HUNT_SONAR_SMALL_ROOM.fromSecondsLeft : HUNT_SONAR_FROM_SECONDS_LEFT;
  return room.phaseEndsAt === null ? null : room.phaseEndsAt - seconds * 1000;
}

/** A seeker while seeking: health, how to zap, dizziness, and the sonar. */
export function SeekerBar({ touch }: { touch: boolean }) {
  const { room, you } = useHuntRoom();
  const me = room?.players.find((p) => p.id === you);
  const dizzyLeft = useSecondsLeft(me?.dizzyUntil ?? null);
  const seeking = room?.status === "seek" && me?.role === "seeker";
  const sonarIn = useSecondsLeft(seeking ? sonarFrom(room!) : null);
  // One sonar a round: used once the room answers it.
  const [usedRound, setUsedRound] = useState(0);
  const round = room?.round ?? 0;
  useEffect(() => onSonar(() => setUsedRound(round)), [round]);
  if (!seeking || !me) return null;
  const sonar = usedRound === round ? "used" : sonarIn > 0 ? "waiting" : "ready";
  const hp = Math.max(0, me.hp);
  const dizzy = dizzyLeft > 0;
  return (
    <>
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 w-64 -translate-x-1/2 sm:bottom-6">
        <div className="glass px-4 py-2.5 text-xs text-stone-100">
          <div className="mb-1 flex justify-between">
            <span>{dizzy ? `Dizzy! ${dizzyLeft} s` : touch ? "Tap Zap to zap" : "Click or Enter to zap · misses cost health"}</span>
            <span className="tabular-nums">{hp} HP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100/15">
            <div className={`h-full rounded-full transition-[width] ${hp > 40 ? "bg-moss-400" : "bg-ember-400"}`} style={{ width: `${(hp / HUNT_HP) * 100}%` }} />
          </div>
          <div className={`mt-2 flex justify-between ${sonar === "ready" ? "text-[#4fb8c9]" : "text-stone-400"}`}>
            <span>{touch ? "Sonar" : "R · Sonar"}: points to the nearest hider</span>
            <span className="tabular-nums">{sonar === "used" ? "used" : sonar === "ready" ? "ready!" : `in ${sonarIn} s`}</span>
          </div>
        </div>
      </div>
      {dizzy && <div className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-[radial-gradient(circle,transparent_40%,rgba(120,80,200,0.35))]" />}
      {touch && (
        <button
          style={{ right: "calc(1.5rem + env(safe-area-inset-right))", bottom: "calc(12.25rem + env(safe-area-inset-bottom))" }}
          className="absolute z-20 grid h-16 w-16 touch-none place-items-center rounded-full bg-ember-400 font-display font-bold text-white shadow-lg select-none active:scale-95"
          onPointerDown={() => (actions.zap = true)}
        >
          Zap
        </button>
      )}
      {touch && sonar === "ready" && (
        <button
          style={{ right: "calc(6.5rem + env(safe-area-inset-right))", bottom: "calc(12.25rem + env(safe-area-inset-bottom))" }}
          className="absolute z-20 grid h-14 w-14 touch-none place-items-center rounded-full bg-[#4fb8c9] text-sm font-bold text-white shadow-lg select-none active:scale-95"
          onPointerDown={() => (actions.sonar = true)}
        >
          Sonar
        </button>
      )}
    </>
  );
}

interface Toast {
  id: number;
  text: ReactNode;
  tone: "good" | "bad" | "plain";
}

/** Short announcements, a few seconds each. */
export function Announcements() {
  const { room, you } = useHuntRoom();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  });
  const status = room?.status;
  const dizzyUntil = room?.players.find((p) => p.id === you)?.dizzyUntil ?? null;

  const say = (text: ReactNode, tone: Toast["tone"] = "plain") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // The seekers coming out.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current === "hide" && status === "seek") {
      const me = roomRef.current?.players.find((p) => p.id === you);
      say(me?.role === "seeker" ? "The door's open. Go find them!" : "The seekers are out. Stay still…", "bad");
      play("alarm");
    }
    lastStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, you]);

  // The last minute: hiders start taunting on their own.
  const left = useSecondsLeft(status === "seek" ? (room?.phaseEndsAt ?? null) : null);
  const lastMinute = status === "seek" && left > 0 && left <= HUNT_FORCED_TAUNT.fromSecondsLeft;
  useEffect(() => {
    if (lastMinute) say(`Last minute! Hiders taunt every ${HUNT_FORCED_TAUNT.everyMs / 1000} s.`, "bad");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMinute]);

  // Too many misses.
  const lastDizzy = useRef(dizzyUntil);
  useEffect(() => {
    if (dizzyUntil && dizzyUntil !== lastDizzy.current) {
      say("Too many misses: you're dizzy!", "bad");
      play("dizzy");
    }
    lastDizzy.current = dizzyUntil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dizzyUntil]);

  useEffect(
    () =>
      onHuntMessage((msg) => {
        const name = (id: string) => roomRef.current?.players.find((p) => p.id === id)?.name ?? "Someone";
        if (msg.type === "found") {
          if (!msg.by) return say(`${name(msg.id)} takes over as a seeker.`);
          if (msg.id === you) {
            play("found");
            return say(<>Found by <b>{name(msg.by)}</b>! You're out this round.</>, "bad");
          }
          if (msg.by === you) return say(<>You found <b>{name(msg.id)}</b>!</>, "good");
          return say(<><b>{name(msg.by)}</b> found <b>{name(msg.id)}</b></>);
        }
        if (msg.type === "decoyPopped") {
          if (msg.by === you) return say("Decoy! That was a fake.", "bad");
          if (msg.mine) return say(<><b>{name(msg.by)}</b> fell for your decoy! +{HUNT_POINTS.decoy}</>, "good");
          return;
        }
        if (msg.type === "exposed") {
          if (msg.ids.includes(you ?? "")) return say("You weren't disguised: everyone saw you!", "bad");
          return say(`${msg.ids.length} ${msg.ids.length === 1 ? "hider was" : "hiders were"} caught out in the open!`, "good");
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [you],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[45%] z-20 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-pop rounded-xs px-5 py-2.5 text-center font-display text-lg font-semibold shadow-[0_24px_60px_-24px_rgba(42,34,22,0.45)] ${
            t.tone === "good" ? "bg-moss-500 text-white" : t.tone === "bad" ? "bg-ember-400 text-white" : "glass text-stone-100"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
