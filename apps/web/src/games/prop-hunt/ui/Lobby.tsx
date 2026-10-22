// Playing with friends: making or joining a room, the room's lobby (who's in, ready, start),
// and, once a match is on, a banner with your role and the phase's clock, each round's
// results, and the podium. Joining is putting the code in the URL (?room=K7MPQ); the page does
// the rest, so a shared link and a typed code take the same path.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_AVATAR, HUNT_FORCED_TAUNT, HUNT_MAX_PLAYERS, HUNT_MIN_PLAYERS, ROOM_CODE_LENGTH, normalizeRoomCode, type HuntPlayerView, type HuntStanding, type HuntView } from "@shadow/shared";
import { AvatarImage } from "../../../avatar/AvatarImage";
import { useHunt } from "../store";
import { LevelBadge, TauntPicker, XpPanel } from "./Levels";
import { createHuntRoom, huntRematch, leaveHuntRoom, peekHuntRoom, setHuntReady, startHunt, toLocalTime, useHuntRoom, type RoomError } from "../room";

export const ROOM_ERRORS: Record<RoomError, string> = {
  full: `That room is full (${HUNT_MAX_PLAYERS} players).`,
  started: "That match has already started. Try again when it ends.",
  not_found: "There's no room with that code.",
  bad_token: "Couldn't check your sign-in. Sign in again, or play as a guest.",
  outdated: "Prop Hunt has been updated. Reload the page to join.",
  bad_message: "Something went wrong. Try again.",
  not_host: "Only the host can start the match.",
  not_ready: `Everyone has to be ready first, and you need at least ${HUNT_MIN_PLAYERS} players.`,
  network: "Couldn't reach the room. Check your connection and try again.",
  replaced: "You opened this room in another tab.",
  create_failed: "Couldn't make a room right now. Try again in a moment.",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-end p-3 sm:p-6 md:items-center md:justify-center">
      <div className="glass pointer-events-auto max-h-full w-full max-w-lg animate-rise touch-pan-y overflow-y-auto overscroll-contain rounded-[1.75rem] p-5 text-stone-100 sm:p-7">{children}</div>
    </div>
  );
}

function ErrorNote({ error }: { error: RoomError }) {
  return <p className="mt-3 rounded-xl bg-ember-400/10 px-3 py-2 text-sm text-ember-300 ring-1 ring-ember-300/30">{ROOM_ERRORS[error]}</p>;
}

function useEnterRoom() {
  const [, setParams] = useSearchParams();
  return (code: string) => setParams({ room: code }, { replace: true });
}

/** Make a room, or type a friend's code. */
export function FriendsCard({ onBack }: { onBack: () => void }) {
  const roomError = useHuntRoom().error;
  const enter = useEnterRoom();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const shown = error ?? roomError;

  const create = async () => {
    setBusy("create");
    setError(null);
    const code = await createHuntRoom();
    setBusy(null);
    if (code) enter(code);
    else setError("create_failed");
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(text);
    if (!code) return setError("not_found");
    setBusy("join");
    setError(null);
    const peek = await peekHuntRoom(code);
    setBusy(null);
    if (!peek) return setError("network");
    if (!peek.exists) return setError("not_found");
    if (peek.status !== "lobby" && peek.status !== "results") return setError("started");
    if (peek.players >= HUNT_MAX_PLAYERS) return setError("full");
    enter(code);
  };

  return (
    <Card>
      <button onClick={onBack} className="text-sm text-stone-400 transition hover:text-stone-200">
        ← Back
      </button>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Play with friends</h1>
      <p className="mt-1.5 text-stone-400">
        {HUNT_MIN_PLAYERS}–{HUNT_MAX_PLAYERS} players. Hiders turn into props; seekers zap anything that looks out of place. Everyone seeks once.
      </p>

      <button onClick={() => void create()} disabled={busy !== null} className="btn btn-primary mt-5 w-full disabled:opacity-60">
        {busy === "create" ? "Making a room…" : "Create a room"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-stone-500 uppercase">
        <span className="h-px flex-1 bg-white/10" />
        or join one
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={(e) => void join(e)} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value.toUpperCase());
            setError(null);
          }}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="CODE"
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-center font-display text-xl font-semibold tracking-[0.4em] uppercase ring-1 ring-white/10 outline-none placeholder:text-stone-600 focus:ring-lamp-300/50"
        />
        <button type="submit" disabled={busy !== null || text.trim().length !== ROOM_CODE_LENGTH} className="btn btn-secondary disabled:opacity-50">
          {busy === "join" ? "Joining…" : "Join"}
        </button>
      </form>

      {shown && <ErrorNote error={shown} />}
    </Card>
  );
}

function Slot({ player, host, you }: { player: HuntPlayerView | undefined; host: boolean; you: boolean }) {
  if (!player) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-3 py-2 text-sm text-stone-500">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.04]">+</span>
        Waiting…
      </li>
    );
  }
  const status = !player.connected ? "Reconnecting…" : host ? "Host" : player.ready ? "Ready" : "Not ready";
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-2 ring-1 ${you ? "bg-lamp-300/10 ring-lamp-300/30" : "bg-white/[0.04] ring-white/10"}`}>
      <AvatarImage config={player.avatar ?? DEFAULT_AVATAR} size="md" className={player.connected ? "" : "opacity-40"} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {player.name}
        {you && <span className="text-stone-400"> (you)</span>}
      </span>
      <LevelBadge level={player.level} />
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          host ? "bg-lamp-300/15 text-lamp-200" : player.ready && player.connected ? "bg-moss-500/20 text-moss-300" : "bg-white/[0.06] text-stone-400"
        }`}
      >
        {host && "👑 "}
        {status}
      </span>
    </li>
  );
}

/** The top three on blocks of their height: gold in the middle. */
function Podium({ standings, you }: { standings: HuntStanding[]; you: string | null }) {
  const top = standings.filter((s) => !s.dnf).slice(0, 3);
  // Second, first, third, left to right.
  const order = [top[1], top[0], top[2]];
  const heights = ["h-16", "h-24", "h-12"];
  const medals = ["🥈", "🥇", "🥉"];
  return (
    <div className="mt-5 flex items-end justify-center gap-2 sm:gap-3">
      {order.map((s, i) =>
        s ? (
          <div key={s.id} className="flex w-24 animate-rise flex-col items-center sm:w-28" style={{ animationDelay: `${[150, 0, 300][i]}ms` }}>
            <AvatarImage config={s.avatar ?? DEFAULT_AVATAR} size={i === 1 ? "xl" : "lg"} className={s.id === you ? "ring-2 ring-lamp-400" : ""} />
            <span className="mt-1.5 max-w-full truncate text-sm font-semibold">{s.name}</span>
            <span className="text-xs text-stone-400 tabular-nums">{s.score} pts</span>
            <div className={`mt-1.5 grid w-full place-items-center rounded-t-md bg-lamp-400/25 text-2xl ring-1 ring-lamp-400/40 ${heights[i]}`}>{medals[i]}</div>
          </div>
        ) : (
          <div key={i} className="w-24 sm:w-28" />
        ),
      )}
    </div>
  );
}

/** The room between matches: its code to share, who's in, ready/start, or the last match's podium. */
export function Lobby() {
  const { code, connection, you, room, standings, error } = useHuntRoom();
  const [, setParams] = useSearchParams();
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);

  const leave = () => {
    leaveHuntRoom();
    setParams({}, { replace: true });
  };

  if (!room) {
    return (
      <Card>
        <p className="eyebrow">Room {code}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Joining…</h1>
        <button onClick={leave} className="btn btn-secondary mt-5 w-full">
          Cancel
        </button>
      </Card>
    );
  }

  const seated = room.players.filter((p) => !p.dnf);
  const me = seated.find((p) => p.id === you);
  const isHost = room.hostId === you;
  const others = seated.filter((p) => p.id !== room.hostId);
  const enough = seated.length >= HUNT_MIN_PLAYERS;
  const everyoneReady = others.every((p) => p.ready && p.connected);
  const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const share = async () => {
    const text = "Come play Prop Hunt with me: hide as a toaster, hunt your friends.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Prop Hunt room", text, url: link });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Room code</p>
          <div className="mt-1 font-display text-4xl font-bold tracking-[0.3em] select-all">{room.code}</div>
        </div>
        <button onClick={() => void share()} className="btn btn-secondary h-9! px-4! text-sm">
          🔗 {copied === "copied" ? "Link copied!" : copied === "failed" ? "Couldn't copy" : "Invite"}
        </button>
      </div>
      {connection === "reconnecting" && (
        <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-stone-300 ring-1 ring-white/10">Connection lost. Reconnecting…</p>
      )}
      {error && <ErrorNote error={error} />}

      {room.status === "results" && standings ? (
        <>
          <Podium standings={standings} you={you} />
          <XpPanel />
          <ol className="mt-4 space-y-1.5 text-sm">
            {standings.map((s) => (
              <li key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.id === you ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.04]"}`}>
                <span className="w-6 text-center text-lg">{["🥇", "🥈", "🥉"][s.place - 1] ?? s.place}</span>
                <AvatarImage config={s.avatar ?? DEFAULT_AVATAR} size="sm" />
                <span className="flex-1 truncate">{s.name}</span>
                <LevelBadge level={room.players.find((p) => p.id === s.id)?.level ?? null} />
                <span className="text-stone-300 tabular-nums">{s.dnf ? "Left" : `${s.score} pts`}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: HUNT_MAX_PLAYERS }, (_, i) => (
            <Slot key={seated[i]?.id ?? `empty-${i}`} player={seated[i]} host={seated[i]?.id === room.hostId} you={seated[i]?.id === you} />
          ))}
        </ul>
      )}

      {room.status === "lobby" &&
        (isHost ? (
          <button onClick={startHunt} disabled={!enough || !everyoneReady} className="btn btn-primary mt-5 w-full disabled:opacity-60">
            {!enough ? `Waiting for at least ${HUNT_MIN_PLAYERS} players…` : everyoneReady ? "Start the match" : "Waiting for everyone to be ready…"}
          </button>
        ) : (
          <button onClick={() => setHuntReady(!me?.ready)} className={`btn mt-5 w-full ${me?.ready ? "btn-secondary" : "btn-primary"}`}>
            {me?.ready ? "Not ready" : "I'm ready"}
          </button>
        ))}
      {room.status === "lobby" && <p className="mt-3 text-center text-xs text-stone-400">Best with 4 or more. One seeker for up to 4 players, two from 5.</p>}
      {room.status === "lobby" && <TauntPicker />}
      {room.status === "results" && (
        <button onClick={huntRematch} className="btn btn-primary mt-5 w-full">
          Play again <span aria-hidden>↻</span>
        </button>
      )}

      <button onClick={leave} className="mt-4 w-full text-sm text-stone-400 transition hover:text-stone-200">
        Leave room
      </button>
    </Card>
  );
}

/** Seconds until a server time, ticking on its own. */
function useCountdown(serverMs: number | null) {
  const [left, setLeft] = useState(0);
  const target = useRef(serverMs);
  useEffect(() => {
    target.current = serverMs;
    const tick = () => setLeft(target.current === null ? 0 : Math.max(0, Math.ceil((toLocalTime(target.current) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [serverMs]);
  return left;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A hider's hint while seeking: what's next, and in the last minute, when they'll taunt whether they like it or not. */
function forcedHint(left: number) {
  const every = HUNT_FORCED_TAUNT.everyMs / 1000;
  if (left > HUNT_FORCED_TAUNT.fromSecondsLeft) return "Stay still, blend in, and survive.";
  const next = every * Math.floor((left - 1) / every);
  return next > 0 ? `Last minute! You'll taunt on your own in ${left - next} s.` : "Hold on, nearly there!";
}

const PHASE: Partial<Record<HuntView["status"], string>> = { countdown: "Get ready", hide: "Hiding", seek: "Seeking", round: "Round over" };

/** During a match: the round, the phase and its clock, and what you should be doing. */
export function MatchBanner() {
  const { you, room } = useHuntRoom();
  const left = useCountdown(room?.phaseEndsAt ?? null);
  const watching = useHunt((s) => s.watching);
  if (!room || !PHASE[room.status]) return null;
  const me = room.players.find((p) => p.id === you);
  const seeker = me?.role === "seeker";
  const out = me?.role === "hider" && me.found && room.status === "seek";
  const watched = room.players.find((p) => p.id === watching)?.name;
  const next = "Space";
  const hint =
    room.status === "countdown" || room.status === "hide"
      ? seeker
        ? "You're a seeker. Wait in the garage: the door opens when hiding ends."
        : "You're a hider. Find a spot and become a prop before the seekers come out!"
      : room.status === "seek"
        ? seeker
          ? "Find the hiders. Zap anything that looks out of place."
          : out
            ? `You were found, so you're out this round. ${watched ? `Watching ${watched} · ${next} for the next player.` : "Watching the others."}`
            : forcedHint(left)
        : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 z-10 flex justify-center px-4">
      <div className={`glass max-w-xl px-4 py-2.5 text-center text-sm text-stone-100 ring-2 ${seeker ? "ring-ember-300/50" : "ring-moss-400/50"}`}>
        <div className="flex items-center justify-center gap-3">
          <span className="label-mono text-stone-400">
            Round {room.round} of {room.rounds}
          </span>
          <b>{PHASE[room.status]}</b>
          <span className="font-mono text-lg tabular-nums">{clock(left)}</span>
          {me?.role && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${out ? "bg-stone-100/15 text-stone-300" : seeker ? "bg-ember-400/20 text-ember-300" : "bg-moss-500/20 text-moss-300"}`}>
              {out ? "Out" : seeker ? "Seeker" : "Hider"}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-stone-300">{hint}</p>}
      </div>
    </div>
  );
}

/** Between rounds: who won, and everyone's points for the round and in total. */
export function RoundCard() {
  const { you, room } = useHuntRoom();
  const left = useCountdown(room?.phaseEndsAt ?? null);
  if (!room || room.status !== "round" || !room.lastRound) return null;
  const { winners, points } = room.lastRound;
  const rows = room.players.filter((p) => !p.dnf).sort((a, b) => b.score - a.score);
  return (
    <Card>
      <p className="eyebrow">
        Round {room.lastRound.round} of {room.rounds}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{winners === "seekers" ? "The seekers found everyone!" : "The hiders survived!"}</h1>
      <ol className="mt-4 space-y-1.5 text-sm">
        {rows.map((p) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.id === you ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.04]"}`}>
            <AvatarImage config={p.avatar ?? DEFAULT_AVATAR} size="sm" />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-moss-300 tabular-nums">+{points[p.id] ?? 0}</span>
            <span className="w-16 text-right text-stone-300 tabular-nums">{p.score} pts</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-sm text-stone-400">{room.round < room.rounds ? `Next round in ${left} s` : `Final scores in ${left} s`}</p>
    </Card>
  );
}
