// Playing with friends: making or joining a room, and the room's lobby (who's in, ready,
// start). Joining a room is putting its code in the URL (?room=K7MPQ); SkyClimbPage does
// the rest, so a shared link and a typed code take the same path.
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_AVATAR, ROOM_CODE_LENGTH, ROOM_MAX_PLAYERS, normalizeRoomCode, type RoomPlayerView } from "@shadow/shared";
import { AvatarImage } from "../../../avatar/AvatarImage";
import { SKY_CLIMB_PATH } from "../config";
import { createRoom, leaveRoom, peekRoom, rematch, setReady, startRace, useRoom, type RoomError } from "../room";

export const ROOM_ERRORS: Record<RoomError, string> = {
  full: `That room is full (${ROOM_MAX_PLAYERS} players).`,
  started: "That race has already started. Try again when it ends.",
  not_found: "There's no room with that code.",
  bad_token: "Couldn't check your sign-in. Sign in again, or play as a guest.",
  outdated: "Sky Climb has been updated. Reload the page to join.",
  bad_message: "Something went wrong. Try again.",
  not_host: "Only the host can start the race.",
  not_ready: "Everyone has to be ready first.",
  network: "Couldn't reach the room. Check your connection and try again.",
  replaced: "You opened this room in another tab.",
  create_failed: "Couldn't make a room right now. Try again in a moment.",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end p-3 sm:p-6 md:items-center">
      <div className="glass pointer-events-auto max-h-full w-full max-w-md animate-rise touch-pan-y overflow-y-auto overscroll-contain rounded-[1.75rem] p-5 sm:p-7">{children}</div>
    </div>
  );
}

function useEnterRoom() {
  const [, setParams] = useSearchParams();
  return (code: string) => setParams({ room: code }, { replace: true });
}

/** Make a room, or type a friend's code. */
export function FriendsCard({ onBack }: { onBack: () => void }) {
  const roomError = useRoom().error;
  const enter = useEnterRoom();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const shown = error ?? roomError;

  const create = async () => {
    setBusy("create");
    setError(null);
    const code = await createRoom();
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
    const peek = await peekRoom(code);
    setBusy(null);
    if (!peek) return setError("network");
    if (!peek.exists) return setError("not_found");
    if (peek.status === "countdown" || peek.status === "racing") return setError("started");
    if (peek.players >= ROOM_MAX_PLAYERS) return setError("full");
    enter(code);
  };

  return (
    <Card>
      <button onClick={onBack} className="text-sm text-stone-400 transition hover:text-stone-200">
        ← Back
      </button>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Play with friends</h1>
      <p className="mt-1.5 text-stone-400">Race up to {ROOM_MAX_PLAYERS - 1} friends on the same tower. Highest climber wins.</p>

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

      {shown && <p className="mt-3 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-300/30">{ROOM_ERRORS[shown]}</p>}
    </Card>
  );
}

function Slot({ player, host, you }: { player: RoomPlayerView | undefined; host: boolean; you: boolean }) {
  if (!player) {
    return (
      <li className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-stone-500 border border-dashed border-white/15">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.04]">+</span>
        Waiting for a friend…
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
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          host ? "bg-lamp-300/15 text-lamp-200" : player.ready && player.connected ? "bg-moss-500/20 text-moss-300" : "bg-white/[0.06] text-stone-400"
        }`}
      >
        {host && "👑 "}
        {status}
      </span>
    </li>
  );
}

/** The room: its code to share, who's in, and ready/start. */
export function Lobby() {
  const { code, connection, you, room, standings, error } = useRoom();
  const [, setParams] = useSearchParams();
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);

  const leave = () => {
    leaveRoom();
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
  const everyoneReady = others.every((p) => p.ready && p.connected);
  const link = `${window.location.origin}${SKY_CLIMB_PATH}?room=${room.code}`;

  const share = async () => {
    const text = "Race me up the Sky Climb tower!";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Sky Climb room", text, url: link });
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
      {error && <p className="mt-3 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-300/30">{ROOM_ERRORS[error]}</p>}

      {room.status === "results" && standings ? (
        <ol className="mt-5 space-y-1.5 text-sm">
          {standings.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.id === you ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.04]"}`}>
              <span className="w-6 text-center text-lg">{["🥇", "🥈", "🥉"][s.place - 1] ?? s.place}</span>
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-stone-300 tabular-nums">{s.dnf ? "Left" : s.summit ? "Summit!" : `Floor ${s.floor}`}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-5 space-y-2">
          {Array.from({ length: ROOM_MAX_PLAYERS }, (_, i) => (
            <Slot key={seated[i]?.id ?? `empty-${i}`} player={seated[i]} host={seated[i]?.id === room.hostId} you={seated[i]?.id === you} />
          ))}
        </ul>
      )}

      {room.status === "lobby" &&
        (isHost ? (
          <button onClick={startRace} disabled={!everyoneReady} className="btn btn-primary mt-5 w-full disabled:opacity-60">
            {seated.length === 1 ? "Start solo race" : everyoneReady ? "Start race" : "Waiting for everyone to be ready…"}
            {everyoneReady && <span aria-hidden>↑</span>}
          </button>
        ) : (
          <button onClick={() => setReady(!me?.ready)} className={`btn mt-5 w-full ${me?.ready ? "btn-secondary" : "btn-primary"}`}>
            {me?.ready ? "Not ready" : "I'm ready"}
          </button>
        ))}
      {(room.status === "countdown" || room.status === "racing") && (
        <p className="mt-5 text-center text-sm text-stone-300">The race is on…</p>
      )}
      {room.status === "results" && (
        <button onClick={rematch} className="btn btn-primary mt-5 w-full">
          Play again <span aria-hidden>↻</span>
        </button>
      )}

      <button onClick={leave} className="mt-4 w-full text-sm text-stone-400 transition hover:text-stone-200">
        Leave room
      </button>
    </Card>
  );
}
