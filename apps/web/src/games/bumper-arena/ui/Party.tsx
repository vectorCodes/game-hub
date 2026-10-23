// Playing with friends: making or joining a room, the room's lobby (who's in, the arena and
// rounds, ready/start), and once a match is on, the scores, each round's results, and the
// podium with its titles, rewards and share text. Joining is putting the code in the URL (?room=K7MPQ); the page does the rest, so a
// shared link and a typed code take the same path.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  BUMPER_KO_POINTS,
  BUMPER_MAPS,
  BUMPER_MAX_PLAYERS,
  BUMPER_MIN_PLAYERS,
  BUMPER_PLACE_POINTS,
  BUMPER_ROTATION,
  BUMPER_ROUND_CHOICES,
  BUMPER_TITLES,
  DEFAULT_AVATAR,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
  type BumperPlayerView,
  type BumperStanding,
} from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { AvatarImage } from "../../../avatar/AvatarImage";
import { RING_COLORS } from "../store";
import {
  bumperRematch,
  createBumperRoom,
  leaveBumperRoom,
  peekBumperRoom,
  setBumperReady,
  setBumperSettings,
  startBumper,
  toLocalTime,
  useBumperRoom,
  type RoomError,
} from "../room";

export const ROOM_ERRORS: Record<RoomError, string> = {
  full: `That room is full (${BUMPER_MAX_PLAYERS} players).`,
  started: "That match has already started. Try again when it ends.",
  not_found: "There's no room with that code.",
  bad_token: "Couldn't check your sign-in. Sign in again, or play as a guest.",
  outdated: "Bumper Arena has been updated. Reload the page to join.",
  bad_message: "Something went wrong. Try again.",
  not_host: "Only the host can do that.",
  not_ready: `Everyone has to be ready first, and you need at least ${BUMPER_MIN_PLAYERS} players.`,
  network: "Couldn't reach the room. Check your connection and try again.",
  replaced: "You opened this room in another tab.",
  create_failed: "Couldn't make a room right now. Try again in a moment.",
};

const MEDALS = ["🥇", "🥈", "🥉"];
const color = (p: { color: number }) => RING_COLORS[p.color] ?? RING_COLORS[0];
const mapName = (id: string) => (id === BUMPER_ROTATION ? "Rotation" : (BUMPER_MAPS[id]?.name ?? id));

function Card({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-stone-950/10 p-4">
      <div className={`glass w-full animate-pop p-6 text-stone-100 ${wide ? "max-w-md" : "max-w-sm"}`}>{children}</div>
    </div>
  );
}

function ErrorNote({ error }: { error: RoomError }) {
  return <p className="mt-3 rounded-xs bg-ember-400/10 px-3 py-2 text-sm text-ember-300 ring-1 ring-ember-300/30">{ROOM_ERRORS[error]}</p>;
}

/** Leaves the room and drops it from the URL, so a reload doesn't join again. */
export function useLeaveRoom() {
  const [, setParams] = useSearchParams();
  return () => {
    leaveBumperRoom();
    setParams({}, { replace: true });
  };
}

/** Make a room, or type a friend's code. */
export function FriendsCard({ onBack }: { onBack: () => void }) {
  const roomError = useBumperRoom().error;
  const [, setParams] = useSearchParams();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const shown = error ?? roomError;
  const enter = (code: string) => setParams({ room: code }, { replace: true });

  const create = async () => {
    setBusy("create");
    setError(null);
    const code = await createBumperRoom();
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
    const peek = await peekBumperRoom(code);
    setBusy(null);
    if (!peek) return setError("network");
    if (!peek.exists) return setError("not_found");
    if (peek.status !== "lobby" && peek.status !== "results") return setError("started");
    if (peek.players >= BUMPER_MAX_PLAYERS) return setError("full");
    enter(code);
  };

  return (
    <Card>
      <button onClick={onBack} className="text-sm text-stone-400 transition hover:text-stone-100">
        ← Back
      </button>
      <h2 className="mt-3 font-display text-4xl">Play with friends</h2>
      <p className="mt-2 text-sm text-stone-300">
        {BUMPER_MIN_PLAYERS}–{BUMPER_MAX_PLAYERS} players, every ring for itself. Shove your friends off the edge; the most points after the last round wins.
      </p>

      <button onClick={() => void create()} disabled={busy !== null} className="btn btn-primary mt-5 w-full disabled:opacity-60">
        {busy === "create" ? "Making a room…" : "Create a room"}
      </button>

      <div className="my-5 flex items-center gap-3 label-mono text-stone-400">
        <span className="h-px flex-1 bg-stone-100/15" />
        or join one
        <span className="h-px flex-1 bg-stone-100/15" />
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
          className="surface h-11 min-w-0 flex-1 px-3 text-center font-display text-xl font-semibold tracking-[0.4em] uppercase outline-none placeholder:text-stone-500"
        />
        <button type="submit" disabled={busy !== null || text.trim().length !== ROOM_CODE_LENGTH} className="btn btn-secondary disabled:opacity-50">
          {busy === "join" ? "Joining…" : "Join"}
        </button>
      </form>

      {shown && <ErrorNote error={shown} />}
    </Card>
  );
}

function Slot({ player, host, you }: { player: BumperPlayerView | undefined; host: boolean; you: boolean }) {
  if (!player) {
    return (
      <li className="flex items-center gap-3 rounded-xs border border-dashed border-stone-100/20 px-3 py-2 text-sm text-stone-400">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-stone-100/5">+</span>
        Waiting…
      </li>
    );
  }
  const status = !player.connected ? "Reconnecting…" : host ? "Host" : player.ready ? "Ready" : "Not ready";
  return (
    <li className={`surface flex items-center gap-3 px-3 py-2 ${you ? "ring-2 ring-gold/60" : ""}`} style={{ boxShadow: `inset 4px 0 0 ${color(player)}` }}>
      <AvatarImage config={player.avatar ?? DEFAULT_AVATAR} size="md" className={player.connected ? "" : "opacity-40"} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {player.name}
        {you && <span className="text-stone-400"> (you)</span>}
      </span>
      <span className={`shrink-0 label-mono ${host || (player.ready && player.connected) ? "text-jade" : "text-stone-400"}`}>{status}</span>
    </li>
  );
}

/** The host picks the arena, how many rounds and whether there are pickups; everyone else sees what was picked. */
function Settings({ host }: { host: boolean }) {
  const { room } = useBumperRoom();
  if (!room) return null;
  // Rooms made before pickups existed have them on.
  const settings = { ...room.settings, pickups: room.settings.pickups !== false };
  if (!host) {
    return (
      <p className="mt-4 text-sm text-stone-300">
        {mapName(settings.map)} · {settings.rounds} rounds · pickups {settings.pickups ? "on" : "off"}
      </p>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="label-mono text-stone-400">Arena</span>
        <select className="surface h-9 px-2" value={settings.map} onChange={(e) => setBumperSettings({ ...settings, map: e.target.value })}>
          <option value={BUMPER_ROTATION}>Rotation (a new one each round)</option>
          {Object.values(BUMPER_MAPS).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1">
        <span className="label-mono text-stone-400">Rounds</span>
        <span className="grid grid-cols-3 gap-1">
          {BUMPER_ROUND_CHOICES.map((n) => (
            <button key={n} className={`h-9 rounded-xs font-mono ${settings.rounds === n ? "bg-ink text-rice" : "surface"}`} onClick={() => setBumperSettings({ ...settings, rounds: n })}>
              {n}
            </button>
          ))}
        </span>
      </div>
      <label className="col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-gold)]"
          checked={settings.pickups}
          onChange={(e) => setBumperSettings({ ...settings, pickups: e.target.checked })}
        />
        <span>Pickups: Heavyweight, Turbo, Shockwave, Bubble, Banana</span>
      </label>
    </div>
  );
}

/** The top three on blocks of their height: gold in the middle. */
function Podium({ standings, you }: { standings: BumperStanding[]; you: string | null }) {
  const top = standings.filter((s) => !s.dnf).slice(0, 3);
  // Second, first, third, left to right.
  const order = [top[1], top[0], top[2]];
  const heights = ["h-14", "h-20", "h-10"];
  return (
    <div className="mt-5 flex items-end justify-center gap-2">
      {order.map((s, i) =>
        s ? (
          <div key={s.id} className="flex w-24 animate-rise flex-col items-center" style={{ animationDelay: `${[150, 0, 300][i]}ms` }}>
            <AvatarImage config={s.avatar ?? DEFAULT_AVATAR} size={i === 1 ? "xl" : "lg"} className={s.id === you ? "ring-2 ring-gold" : ""} />
            <span className="mt-1.5 max-w-full truncate text-sm font-semibold">{s.name}</span>
            <span className="text-xs text-stone-400 tabular-nums">{s.score} pts</span>
            {s.title && (
              <span className="mt-0.5 max-w-full truncate rounded-xs bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-rice uppercase" title={BUMPER_TITLES[s.title].blurb}>
                {BUMPER_TITLES[s.title].name}
              </span>
            )}
            <div className={`mt-1.5 grid w-full place-items-center rounded-t-xs text-2xl ${heights[i]}`} style={{ background: `${color(s)}55`, boxShadow: `inset 0 3px 0 ${color(s)}` }}>
              {MEDALS[s.place - 1] ?? s.place}
            </div>
          </div>
        ) : (
          <div key={i} className="w-24" />
        ),
      )}
    </div>
  );
}

/** The match, ready to paste: how many played, and how you did. */
function shareText(standings: BumperStanding[], rounds: number, you: string | null) {
  const me = standings.find((s) => s.id === you);
  const players = standings.filter((s) => !s.dnf).length;
  const lines = [`Bumper Arena · party of ${players} · ${rounds} rounds`];
  if (me) {
    const parts = [`${MEDALS[me.place - 1] ?? `#${me.place}`} ${me.score} pts`, `${me.roundWins} ${me.roundWins === 1 ? "round" : "rounds"} won`, `${me.kos} KOs`];
    if (me.title) parts.push(BUMPER_TITLES[me.title].name);
    lines.push(parts.join(" · "));
  }
  lines.push(`${window.location.origin}/games/bumper-arena`);
  return lines.join("\n");
}

function ShareResult({ standings, rounds, you }: { standings: BumperStanding[]; rounds: number; you: string | null }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText(standings, rounds, you));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };
  return (
    <button onClick={() => void share()} className="btn btn-secondary mt-4 w-full">
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

/** What the match earned you: XP towards your Bumper level, and coins for the avatar shop. */
function Rewards() {
  const signedIn = useAuth((s) => s.user !== null);
  const authEnabled = useAuth((s) => s.enabled);
  const signIn = useAuth((s) => s.signIn);
  const gain = useBumperRoom().xp;
  if (!signedIn) {
    if (!authEnabled) return null;
    return (
      <div className="surface mt-4 flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="text-stone-300">Sign in to earn XP and coins from your matches.</span>
        <button onClick={() => void signIn()} className="btn btn-secondary h-8! shrink-0 px-3! text-xs">
          Sign in
        </button>
      </div>
    );
  }
  if (gain === undefined) return <p className="mt-4 text-center text-sm text-stone-400">Saving your XP…</p>;
  if (gain === null) return <p className="mt-4 text-center text-sm text-stone-400">Your XP couldn't be saved this time.</p>;
  const levelled = gain.level > gain.levelBefore;
  const share = Math.max(0, Math.min(1, (gain.xp - gain.levelXp) / (gain.nextLevelXp - gain.levelXp || 1)));
  return (
    <div className={`surface mt-4 animate-rise px-3 py-2.5 ${levelled ? "ring-2 ring-gold/60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl">{levelled ? `Level ${gain.level}!` : `Level ${gain.level}`}</span>
        <span className="font-mono text-sm tabular-nums">
          +{gain.gained} XP · <span className="text-gold">+{gain.coins} coins</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100/10">
        <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-stone-400 tabular-nums">
        {gain.nextLevelXp - gain.xp} XP to level {gain.level + 1} · coins buy avatar items
      </p>
    </div>
  );
}

/** The room between matches: its code to share, who's in, the settings and ready/start, or the last match's podium. */
export function Lobby() {
  const { code, connection, you, room, standings, error } = useBumperRoom();
  const leave = useLeaveRoom();
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);

  if (!room) {
    return (
      <Card>
        <div className="label-mono text-stone-400">Room {code}</div>
        <h2 className="mt-1 font-display text-4xl">Joining…</h2>
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
  const enough = seated.length >= BUMPER_MIN_PLAYERS;
  const everyoneReady = others.every((p) => p.ready && p.connected);
  const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const share = async () => {
    const text = "Come play Bumper Arena with me: bump me off the edge if you can.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Bumper Arena room", text, url: link });
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
    <Card wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-mono text-stone-400">Room code</div>
          <div className="mt-1 font-display text-4xl font-bold tracking-[0.3em] select-all">{room.code}</div>
        </div>
        <button onClick={() => void share()} className="btn btn-secondary h-9! px-4! text-sm">
          {copied === "copied" ? "Link copied!" : copied === "failed" ? "Couldn't copy" : "Invite"}
        </button>
      </div>
      {connection === "reconnecting" && <p className="mt-3 rounded-xs bg-stone-100/5 px-3 py-2 text-sm text-stone-300">Connection lost. Reconnecting…</p>}
      {error && <ErrorNote error={error} />}

      {room.status === "results" && standings ? (
        <>
          <Podium standings={standings} you={you} />
          <Rewards />
          <ol className="mt-4 divide-y divide-stone-100/10 text-sm">
            {standings.map((s) => (
              <li key={s.id} className={`flex items-center gap-2 py-1.5 ${s.id === you ? "font-semibold" : ""}`}>
                <span className="w-6 text-center">{MEDALS[s.place - 1] ?? s.place}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: color(s) }} />
                <span className="flex-1 truncate">
                  {s.name}
                  {s.title && <span className="ml-1.5 text-xs font-normal text-stone-400">· {BUMPER_TITLES[s.title].name}</span>}
                </span>
                <span className="text-xs text-stone-400 tabular-nums">
                  {s.roundWins} won · {s.kos} KOs
                </span>
                <span className="w-16 text-right font-mono tabular-nums">{s.dnf ? "Left" : `${s.score} pts`}</span>
              </li>
            ))}
          </ol>
          <ShareResult standings={standings} rounds={room.rounds} you={you} />
        </>
      ) : (
        <>
          <ul className="mt-5 grid gap-2">
            {Array.from({ length: BUMPER_MAX_PLAYERS }, (_, i) => (
              <Slot key={seated[i]?.id ?? `empty-${i}`} player={seated[i]} host={seated[i]?.id === room.hostId} you={seated[i]?.id === you} />
            ))}
          </ul>
          <Settings host={isHost} />
        </>
      )}

      {room.status === "lobby" &&
        (isHost ? (
          <button onClick={startBumper} disabled={!enough || !everyoneReady} className="btn btn-primary mt-5 w-full disabled:opacity-60">
            {!enough ? `Waiting for at least ${BUMPER_MIN_PLAYERS} players…` : everyoneReady ? "Start the match" : "Waiting for everyone to be ready…"}
          </button>
        ) : (
          <button onClick={() => setBumperReady(!me?.ready)} className={`btn mt-5 w-full ${me?.ready ? "btn-secondary" : "btn-primary"}`}>
            {me?.ready ? "Not ready" : "I'm ready"}
          </button>
        ))}
      {room.status === "results" && (
        <button onClick={bumperRematch} className="btn btn-primary mt-5 w-full">
          Play again
        </button>
      )}

      <button onClick={leave} className="mt-3 w-full text-sm text-stone-400 transition hover:text-stone-100">
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

/** During a match: the round, and everyone's points so far, under the corner buttons. */
export function Scores() {
  const { you, room } = useBumperRoom();
  if (!room || (room.status !== "round" && room.status !== "roundOver")) return null;
  const rows = room.players.filter((p) => !p.dnf || room.entrants.includes(p.id)).sort((a, b) => b.score - a.score);
  return (
    <div className="pointer-events-none absolute top-16 left-4 z-10">
      <div className="glass min-w-40 px-3 py-2 text-xs text-stone-100">
        <div className="label-mono text-stone-400">
          Round {room.round} of {room.rounds}
        </div>
        <ul className="mt-1 space-y-0.5">
          {rows.map((p) => (
            <li key={p.id} className={`flex items-center gap-2 ${p.id === you ? "font-semibold" : ""} ${p.connected && !p.dnf ? "" : "opacity-50"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(p) }} />
              <span className="max-w-28 truncate">{p.name}</span>
              <span className="ml-auto pl-3 font-mono tabular-nums">{p.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Between rounds: places, knockouts and points, a beat after the last ring falls. */
export function RoundCard() {
  const { you, room } = useBumperRoom();
  const left = useCountdown(room?.phaseEndsAt ?? null);
  const over = room?.status === "roundOver";
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!over) return setShow(false);
    const id = setTimeout(() => setShow(true), 1400);
    return () => clearTimeout(id);
  }, [over]);
  if (!room || !over || !show || !room.lastRound) return null;
  const { places, points, kos } = room.lastRound;
  const rows = room.players.filter((p) => p.id in places).sort((a, b) => places[a.id] - places[b.id] || b.score - a.score);
  const winners = rows.filter((p) => places[p.id] === 1);
  const title =
    winners.length === 1 ? (winners[0].id === you ? "You win the round!" : `${winners[0].name} wins the round`) : winners.some((p) => p.id === you) ? "You share the round!" : "A shared round";

  return (
    <Card wide>
      <div className="label-mono text-stone-400">
        Round {room.lastRound.round} of {room.rounds} · {mapName(room.lastRound.map)}
      </div>
      <h2 className="mt-1 font-display text-4xl">{title}</h2>
      <ol className="mt-4 divide-y divide-stone-100/10 text-sm">
        {rows.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 py-1.5 ${p.id === you ? "font-semibold" : ""}`}>
            <span className="w-6 text-center">{MEDALS[places[p.id] - 1] ?? places[p.id]}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: color(p) }} />
            <span className="flex-1 truncate">{p.name}</span>
            {kos[p.id] ? <span className="text-xs text-stone-400">{kos[p.id]} KO</span> : null}
            <span className="w-10 text-right font-mono text-jade tabular-nums">+{points[p.id] ?? 0}</span>
            <span className="w-16 text-right font-mono tabular-nums">{p.score} pts</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-xs text-stone-400">
        {BUMPER_PLACE_POINTS.join(" / ")} for the top places · +{BUMPER_KO_POINTS} a knockout
      </p>
      <p className="mt-3 text-center text-sm text-stone-300">{room.round < room.rounds ? `Next round in ${left} s` : `Final scores in ${left} s`}</p>
    </Card>
  );
}
