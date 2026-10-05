// A room's race on screen: the 3-2-1 countdown, everyone's floor and the time left while
// climbing, and the podium at the end.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_AVATAR, type RoomStanding } from "@shadow/shared";
import { AvatarImage } from "../../../avatar/AvatarImage";
import { formatDuration } from "../../../lib/format";
import { leaveRoom, rematch, useRoom } from "../room";
import { useClimb } from "../store";

/** Re-renders every `ms` while `on`. */
function useNow(ms: number, on = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return now;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** 3, 2, 1, GO! over the tower. */
export function RaceCountdown() {
  const race = useClimb((s) => s.race);
  const now = useNow(100, race !== null);
  if (!race) return null;
  const left = race.startAt - now;
  if (left < -900) return null;
  const text = left > 0 ? String(Math.ceil(left / 1000)) : "GO!";
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div key={text} className="animate-pop text-center">
        <div className={`font-display font-bold drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)] ${left > 0 ? "text-8xl text-white" : "text-7xl text-lamp-300"}`}>{text}</div>
        {left > 0 && <div className="mt-2 text-lg font-medium text-stone-200 drop-shadow">Get ready…</div>}
      </div>
    </div>
  );
}

/** Time left in the race, for the HUD. */
export function RaceClock({ endsAt }: { endsAt: number }) {
  const now = useNow(250);
  const left = endsAt - now;
  return <span className={`tabular-nums ${left < 30_000 ? "text-rose-300" : ""}`}>{clock(left)}</span>;
}

/** Everyone's floor, highest first, for the HUD. */
export function RaceStandings() {
  const { room, you } = useRoom();
  if (!room || room.players.length < 2) return null;
  const players = room.players.slice().sort((a, b) => b.floor - a.floor);
  return (
    <ol className="flex flex-wrap justify-center gap-1.5">
      {players.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 backdrop-blur-md ${
            p.id === you ? "bg-lamp-300/20 text-lamp-100 ring-lamp-300/40" : "bg-stone-950/70 text-stone-100 ring-white/10"
          } ${p.dnf ? "opacity-50" : ""}`}
        >
          <span className="text-xs text-stone-400">{i + 1}</span>
          <span className="max-w-24 truncate font-medium">{p.id === you ? "You" : p.name}</span>
          <span className="font-semibold tabular-nums">{p.dnf ? "left" : p.floor}</span>
          {p.finished && !p.dnf && <span aria-label="finished">🏁</span>}
        </li>
      ))}
    </ol>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
/** Podium steps, by place. */
const STEP = ["h-28", "h-20", "h-14"];

function result(s: RoomStanding) {
  if (s.dnf) return "Left the race";
  if (s.summit) return `Summit in ${formatDuration((s.ms ?? 0) / 1000)}`;
  return s.floor > 0 ? `Floor ${s.floor}` : "Didn't climb";
}

function Podium({ standings, you }: { standings: RoomStanding[]; you: string | null }) {
  // 2nd, 1st, 3rd: the winner in the middle.
  const order = [standings[1], standings[0], standings[2]].filter(Boolean);
  return (
    <div className="mt-6 flex items-end justify-center gap-3">
      {order.map((s) => (
        <div key={s.id} className="flex w-28 animate-rise flex-col items-center" style={{ animationDelay: `${(3 - s.place) * 120}ms` }}>
          <AvatarImage config={s.avatar ?? DEFAULT_AVATAR} size="lg" className={s.dnf ? "opacity-40" : ""} />
          <div className="mt-1 max-w-full truncate text-sm font-semibold">
            {s.name}
            {s.id === you && <span className="text-stone-400"> (you)</span>}
          </div>
          <div className="text-xs text-stone-400">{result(s)}</div>
          <div
            className={`mt-2 grid w-full place-items-center rounded-t-xl text-3xl ring-1 ${STEP[s.place - 1]} ${
              s.place === 1 ? "bg-lamp-300/25 ring-lamp-300/40" : "bg-white/[0.06] ring-white/10"
            }`}
          >
            {MEDALS[s.place - 1]}
          </div>
        </div>
      ))}
    </div>
  );
}

/** After your climb: waiting for the others, then the podium. */
export function RaceResults() {
  const { room, you, standings } = useRoom();
  const floor = useClimb((s) => s.floor);
  const race = useClimb((s) => s.race);
  const [, setParams] = useSearchParams();
  const done = room?.status === "results" && standings !== null;

  const leave = () => {
    leaveRoom();
    setParams({}, { replace: true });
  };

  const winner = done ? standings[0] : null;
  const title = !winner || !standings
    ? floor > 0
      ? `You reached floor ${floor}`
      : "You stopped climbing"
    : standings.length === 1
      ? result(winner)
      : winner.id === you
        ? "You win!"
        : `${winner.name} wins!`;

  return (
    <div className="absolute inset-0 grid place-items-center bg-stone-950/40 p-4 backdrop-blur-[2px]">
      <div className="glass w-full max-w-md animate-pop rounded-[1.75rem] p-6 text-center sm:p-8">
        <div className="text-5xl">{winner ? (winner.id === you ? "🏆" : "🏁") : "⏳"}</div>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">{title}</h2>

        {done ? (
          standings.length > 1 && <Podium standings={standings} you={you} />
        ) : (
          <>
            <p className="mt-2 text-stone-400">
              Waiting for the others to finish
              {race && (
                <>
                  {" "}
                  · <RaceClock endsAt={race.endsAt} /> left
                </>
              )}
            </p>
            <div className="mt-5">
              <RaceStandings />
            </div>
          </>
        )}

        <div className="mt-7 flex flex-col gap-3">
          {done && (
            <button onClick={rematch} className="btn btn-primary w-full">
              Play again <span aria-hidden>↻</span>
            </button>
          )}
          <button onClick={leave} className="btn btn-secondary w-full">
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
