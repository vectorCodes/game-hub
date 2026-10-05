// The start menu (mode, climber, today's leaderboard) and the results after a climb.
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CLIMB_ACHIEVEMENTS, DEFAULT_AVATAR, type ClimbChallengeView, type ClimbLeaderboardEntry, type ClimbMode } from "@shadow/shared";
import { AvatarImage } from "../../../avatar/AvatarImage";
import { useAvatar } from "../../../avatar/store";
import { useAuth } from "../../../auth/store";
import { GoogleIcon } from "../../../auth/AuthMenu";
import { Segmented } from "../../../components/Segmented";
import { formatDuration } from "../../../lib/format";
import { FLOORS, SKY_CLIMB_PATH, ZONES } from "../config";
import { liveAvailable } from "../live";
import { clearRoomError, roomsAvailable, useRoom } from "../room";
import { localBest, useClimb } from "../store";
import { FriendsCard, ROOM_ERRORS } from "./Lobby";

const MODES: { value: ClimbMode; label: string }[] = [
  { value: "daily", label: "Today's tower" },
  { value: "practice", label: "Practice" },
];


function Board({ entries, me }: { entries: ClimbLeaderboardEntry[]; me: ClimbLeaderboardEntry | null }) {
  const rows = entries.slice(0, 5);
  const showMe = me && !rows.some((r) => r.isMe);
  if (!rows.length) return <p className="text-sm text-stone-400">Nobody has climbed today&rsquo;s tower yet. Be the first!</p>;
  return (
    <ol className="space-y-1 text-sm">
      {[...rows, ...(showMe ? [me] : [])].map((e) => (
        <li
          key={`${e.rank}-${e.name}-${e.isMe}`}
          className={`flex items-center justify-between rounded-xl px-3 py-1.5 ${e.isMe ? "bg-lamp-300/15 text-lamp-100 ring-1 ring-lamp-300/30" : "bg-white/[0.03]"}`}
        >
          <span className="flex items-center gap-2">
            <span className="w-5 text-right text-stone-500 tabular-nums">{e.rank}</span>
            {e.name}
          </span>
          <span className="tabular-nums text-stone-300">
            Floor {e.floor} <span className="text-stone-500">· {formatDuration(e.seconds)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Who sent the challenge link, and the climb to beat. */
function ChallengeCard({ challenge }: { challenge: ClimbChallengeView }) {
  const clearChallenge = useClimb((s) => s.clearChallenge);
  const [, setParams] = useSearchParams();
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl bg-rose-400/10 px-3 py-2.5 ring-1 ring-rose-300/30">
      <AvatarImage config={challenge.avatar ?? DEFAULT_AVATAR} size="lg" className="h-12! w-12!" />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[11px] font-semibold tracking-[0.16em] text-rose-200 uppercase">
          ⚔️ {challenge.isMe ? "Your own challenge" : `Challenge from ${challenge.name}`}
        </div>
        <div className="font-display text-lg font-semibold">
          Floor {challenge.floor} <span className="text-stone-400">in {formatDuration(challenge.seconds)}</span>
        </div>
        <div className="text-xs text-stone-400">{challenge.mode === "daily" ? "Today's tower: counts for the leaderboard" : "Their tower, as practice"}</div>
      </div>
      <button
        onClick={() => {
          clearChallenge();
          setParams({}, { replace: true });
        }}
        className="rounded-full px-2.5 py-1 text-xs text-stone-400 ring-1 ring-white/10 hover:text-stone-100"
      >
        Leave
      </button>
    </div>
  );
}

/** Ghosts and live climbers, on or off. */
function OthersToggles() {
  const mode = useClimb((s) => s.mode);
  const showGhosts = useClimb((s) => s.showGhosts);
  const showLive = useClimb((s) => s.showLive);
  const setOthers = useClimb((s) => s.setOthers);
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${on ? "bg-white/10 text-stone-100 ring-white/25" : "text-stone-500 ring-white/10 hover:text-stone-300"}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-400">
      <span>Climb with:</span>
      <button aria-pressed={showGhosts} onClick={() => setOthers({ ghosts: !showGhosts })} className={pill(showGhosts)}>
        👻 Ghosts
      </button>
      {liveAvailable && mode === "daily" && (
        <button aria-pressed={showLive} onClick={() => setOthers({ live: !showLive })} className={pill(showLive)}>
          🟢 Live climbers
        </button>
      )}
    </div>
  );
}

function SignInNudge({ text }: { text: string }) {
  const { enabled, user, signIn } = useAuth();
  if (!enabled || user) return null;
  return (
    <button
      onClick={() => void signIn()}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-stone-100 ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <GoogleIcon />
      {text}
    </button>
  );
}

export function Menu() {
  const mode = useClimb((s) => s.mode);
  const setMode = useClimb((s) => s.setMode);
  const profile = useClimb((s) => s.profile);
  const openLocker = useClimb((s) => s.setLockerOpen);
  const start = useClimb((s) => s.start);
  const phase = useClimb((s) => s.phase);
  const daily = useClimb((s) => s.daily);
  const avatar = useAvatar((s) => s.config);
  const custom = useAvatar((s) => s.custom);
  const challenge = useClimb((s) => s.challenge);
  const challengeFailed = useClimb((s) => s.challengeFailed);
  const clearChallenge = useClimb((s) => s.clearChallenge);
  const roomError = useRoom().error;
  const [friends, setFriends] = useState(false);
  const best = localBest(mode);

  if (friends) {
    return (
      <FriendsCard
        onBack={() => {
          clearRoomError();
          setFriends(false);
        }}
      />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end p-3 sm:p-6 md:items-center">
      <div className="glass pointer-events-auto w-full max-w-md animate-rise rounded-[1.75rem] p-5 sm:p-7">
        <p className="eyebrow">{mode === "daily" && daily ? `Tower #${daily.number} · ${daily.climbers} climbing today` : "GameHub"}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Sky Climb</h1>
        <p className="mt-1.5 text-stone-400">Climb as high as you can. It gets harder the higher you go.</p>

        {challenge ? <ChallengeCard challenge={challenge} /> : <Segmented className="mt-5" label="Mode" options={MODES} value={mode} onChange={setMode} />}
        {roomError && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-stone-300 ring-1 ring-white/10">
            {ROOM_ERRORS[roomError]}
            <button onClick={clearRoomError} aria-label="Dismiss" className="text-stone-500 hover:text-stone-200">
              ✕
            </button>
          </p>
        )}
        {challengeFailed && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-stone-300 ring-1 ring-white/10">
            That challenge link didn&rsquo;t open. Climb today&rsquo;s tower instead!
            <button onClick={clearChallenge} aria-label="Dismiss" className="text-stone-500 hover:text-stone-200">
              ✕
            </button>
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <AvatarImage config={avatar} size="lg" className="h-12! w-12!" />
            <div className="text-left">
              <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Your climber</div>
              <div className="font-display text-lg font-semibold">{custom ? "Your avatar" : "Make it yours"}</div>
            </div>
          </div>
          <Link to="/avatar?from=sky-climb" className="btn btn-secondary h-9! px-4! text-sm">
            ✏️ Customize
          </Link>
        </div>

        <button
          onClick={() => openLocker(true)}
          className="mt-2 flex w-full items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm ring-1 ring-white/10 transition hover:bg-white/[0.08]"
        >
          <span>🎒 Locker · styles, hats, trails, awards</span>
          <span className="font-semibold text-lamp-200 tabular-nums">🪙 {profile.coins.balance}</span>
        </button>
        <OthersToggles />

        <button onClick={() => void start()} disabled={phase === "starting"} className="btn btn-primary mt-5 w-full disabled:opacity-60">
          {phase === "starting"
            ? "Getting ready…"
            : challenge && !challenge.isMe
              ? `Beat ${challenge.name}`
              : best > 0
                ? "Climb again"
                : "Start climbing"}
          <span aria-hidden>↑</span>
        </button>
        {roomsAvailable && (
          <button onClick={() => setFriends(true)} className="btn btn-secondary mt-2 w-full">
            👥 Play with friends
          </button>
        )}
        {best > 0 && (
          <p className="mt-2 text-center text-sm text-stone-400">
            Your best {mode === "daily" ? "today" : "in practice"}: <span className="font-semibold text-stone-100">floor {best}</span>
          </p>
        )}

        {mode === "daily" ? (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Today&rsquo;s highest</p>
            {daily ? <Board entries={daily.top} me={daily.me} /> : <p className="text-sm text-stone-500">Loading…</p>}
            <div className="mt-3">
              <SignInNudge text="Sign in to join the leaderboard" />
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {ZONES.map((z) => (
              <span key={z.id} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-stone-300 ring-1 ring-white/10">
                {z.emoji} {z.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Results() {
  const floor = useClimb((s) => s.floor);
  const coins = useClimb((s) => s.coins);
  const falls = useClimb((s) => s.falls);
  const startedAt = useClimb((s) => s.startedAt) ?? 0;
  const endedAt = useClimb((s) => s.endedAt) ?? Date.now();
  const previousBest = useClimb((s) => s.previousBest);
  const mode = useClimb((s) => s.mode);
  const daily = useClimb((s) => s.daily);
  const start = useClimb((s) => s.start);
  const backToMenu = useClimb((s) => s.backToMenu);
  const summit = floor >= FLOORS;
  const newBest = floor > previousBest;
  const zone = [...ZONES].reverse().find((z) => floor >= z.from) ?? ZONES[0];
  const unlocked = useClimb((s) => s.unlocked);
  const balance = useClimb((s) => s.profile.coins.balance);
  const openLocker = useClimb((s) => s.setLockerOpen);
  const challenge = useClimb((s) => s.challenge);
  const shareRunId = useClimb((s) => s.shareRunId);
  const [shared, setShared] = useState<"copied" | "failed" | null>(null);
  const seconds = (endedAt - startedAt) / 1000;
  const beatChallenge = challenge && (floor > challenge.floor || (floor === challenge.floor && seconds < challenge.seconds));

  const share = async () => {
    const url = `${window.location.origin}${SKY_CLIMB_PATH}?challenge=${shareRunId}`;
    const text = summit ? `I reached the summit of Sky Climb in ${formatDuration(seconds)}. Can you beat me?` : `I reached floor ${floor} on Sky Climb. Can you beat me?`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Sky Climb challenge", text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared("copied");
    } catch {
      setShared("failed");
    }
  };

  const stats = [
    { label: "Floor", value: `${floor}` },
    { label: "Time", value: formatDuration(seconds) },
    { label: "Coins", value: `${coins}` },
    { label: "Falls", value: `${falls}` },
  ];

  return (
    <div className="absolute inset-0 grid place-items-center bg-stone-950/40 p-4 backdrop-blur-[2px]">
      <div className="glass w-full max-w-md animate-pop rounded-[1.75rem] p-6 text-center sm:p-8">
        <div className="text-5xl">{summit ? "🏁" : zone.emoji}</div>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">{summit ? "You reached the summit!" : `You reached floor ${floor}`}</h2>
        <p className="mt-2 text-stone-400">
          {summit ? "Above the storm, under the stars." : newBest && floor > 0 ? "That's a new personal best!" : `Made it to ${zone.name}. Keep climbing!`}
        </p>

        <dl className="mt-6 grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[0.04] px-2 py-3 ring-1 ring-white/10">
              <dd className="font-display text-xl font-semibold tabular-nums">{s.value}</dd>
              <dt className="text-[11px] font-medium tracking-wide text-stone-400 uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>

        {unlocked.length > 0 && (
          <div className="mt-5 space-y-2">
            {unlocked.map((id) => {
              const a = CLIMB_ACHIEVEMENTS.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex animate-pop items-center gap-3 rounded-2xl bg-moss-500/15 px-4 py-2.5 text-left ring-1 ring-moss-400/40">
                  <span className="text-2xl">{a.emoji}</span>
                  <span>
                    <span className="block text-[11px] font-semibold tracking-[0.16em] text-moss-300 uppercase">Achievement unlocked</span>
                    <span className="font-medium">{a.name}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {challenge && !challenge.isMe && (
          <div
            className={`mt-5 flex animate-pop items-center gap-3 rounded-2xl px-4 py-2.5 text-left ring-1 ${beatChallenge ? "bg-moss-500/15 ring-moss-400/40" : "bg-rose-400/10 ring-rose-300/30"}`}
          >
            <AvatarImage config={challenge.avatar ?? DEFAULT_AVATAR} size="md" />
            <span>
              <span className={`block text-[11px] font-semibold tracking-[0.16em] uppercase ${beatChallenge ? "text-moss-300" : "text-rose-200"}`}>
                {beatChallenge ? "Challenge won" : "Challenge"}
              </span>
              <span className="font-medium">
                {beatChallenge
                  ? `You beat ${challenge.name}!`
                  : `${challenge.name} is still ahead: floor ${challenge.floor} in ${formatDuration(challenge.seconds)}`}
              </span>
            </span>
          </div>
        )}

        {mode === "daily" && daily?.me && (
          <p className="mt-5 text-sm text-stone-300">
            You&rsquo;re <span className="font-semibold text-lamp-200">#{daily.me.rank}</span> of {daily.climbers} on today&rsquo;s tower.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button onClick={() => void start()} className="btn btn-primary w-full">
            {challenge && !beatChallenge && !challenge.isMe ? "Try again" : "Climb again"} <span aria-hidden>↑</span>
          </button>
          {shareRunId && (
            <button onClick={() => void share()} className="btn btn-secondary w-full">
              ⚔️ {shared === "copied" ? "Link copied!" : shared === "failed" ? "Couldn't copy the link" : "Challenge a friend"}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openLocker(true)} className="btn btn-secondary">
              🎒 Locker <span className="text-lamp-200 tabular-nums">🪙 {balance}</span>
            </button>
            <button onClick={backToMenu} className="btn btn-secondary">
              Menu
            </button>
          </div>
          <Link to="/" className="text-sm text-stone-400 transition hover:text-stone-200">
            ← All games
          </Link>
          {mode === "daily" && <SignInNudge text="Sign in to save your climb" />}
        </div>
      </div>
    </div>
  );
}
