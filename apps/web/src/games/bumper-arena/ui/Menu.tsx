// The start menu, over a bots-only round on Picnic Plate: today's Daily Gauntlet (arena,
// twist, how today is going), Practice (arena, bots, level), and a party room with friends.
import { useEffect, type ReactNode } from "react";
import { BUMPER_MAPS, BUMPER_MAX_PLAYERS, BUMPER_MIN_PLAYERS, BUMPER_MODIFIERS, bumperDay } from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { savedDaily, today } from "../guest";
import { roomsAvailable } from "../room";
import { useBumper } from "../store";
import { PracticeSettings } from "./Hud";

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded-xs bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-950">{children}</kbd>;
}

export function Menu({ touch, onFriends }: { touch: boolean; onFriends: () => void }) {
  const daily = useBumper((s) => s.daily);
  const loadDaily = useBumper((s) => s.loadDaily);
  const startGauntlet = useBumper((s) => s.startGauntlet);
  const startPractice = useBumper((s) => s.startPractice);
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);

  // Today's Gauntlet as the server sees it, once we know who's asking.
  useEffect(() => {
    if (synced) void loadDaily();
  }, [synced, userId, loadDaily]);

  const day = daily?.day ?? bumperDay(today());
  const map = BUMPER_MAPS[day.map];
  const twist = BUMPER_MODIFIERS[day.modifier];
  const local = savedDaily(day.date);
  const mine = daily?.mine ?? (local ? { waves: local.waves, kos: local.kos, score: local.score, rank: null } : null);

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#f3ead9]/55 px-4 pt-20 pb-8 backdrop-blur-[2px]">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-display text-5xl text-ink [text-shadow:0_2px_0_rgba(255,255,255,0.6)] sm:text-6xl">Bumper Arena</h1>
          <p className="mt-2 font-serif text-stone-300">Bump them off the edge. Last ring rolling wins.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="glass flex flex-col p-6 text-stone-100">
            <div className="label-mono text-stone-400">Daily Gauntlet #{day.number}</div>
            <h2 className="mt-1 font-display text-3xl">
              {map?.name ?? day.map}, {twist.name}
            </h2>
            <p className="mt-2 text-sm text-stone-300">{twist.blurb} Waves of bots, one life. How many waves can you clear?</p>
            <p className="mt-3 text-sm text-stone-400">
              {daily ? (daily.players ? `${daily.players} ${daily.players === 1 ? "player" : "players"} today · best ${daily.best} waves` : "Nobody has run it yet today.") : " "}
            </p>
            <div className="mt-auto pt-5">
              {mine && (
                <p className="mb-3 rounded-xs bg-jade/15 px-3 py-2 text-sm">
                  Your run: <b>{mine.waves} waves</b> · {mine.kos} KOs · {mine.score} pts{mine.rank ? ` · #${mine.rank} today` : ""}
                </p>
              )}
              <button className="btn btn-primary w-full" onClick={startGauntlet}>
                {mine ? "Run it again (won't count)" : "Run today's Gauntlet"}
              </button>
            </div>
          </section>

          <section className="glass flex flex-col p-6 text-stone-100">
            <div className="label-mono text-stone-400">Practice</div>
            <h2 className="mt-1 font-display text-3xl">You vs bots</h2>
            <p className="mt-2 mb-5 text-sm text-stone-300">Any arena, as many bots as you like. Nothing at stake.</p>
            <PracticeSettings />
            <button className="btn btn-secondary mt-5 w-full" onClick={() => startPractice()}>
              Practice
            </button>
          </section>
        </div>

        {roomsAvailable && (
          <section className="glass mt-4 flex flex-col items-start gap-4 p-6 text-stone-100 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="label-mono text-stone-400">
                Party · {BUMPER_MIN_PLAYERS}–{BUMPER_MAX_PLAYERS} players
              </div>
              <h2 className="mt-1 font-display text-3xl">With friends</h2>
              <p className="mt-1 text-sm text-stone-300">Make a room, send the link, and bump each other off for a few rounds.</p>
            </div>
            <button className="btn btn-primary w-full sm:w-auto" onClick={onFriends}>
              Play with friends
            </button>
          </section>
        )}

        {!touch && (
          <p className="mt-6 text-center text-sm text-stone-300">
            <Kbd>WASD</Kbd> drive · <Kbd>Space</Kbd> dash · <Kbd>Shift</Kbd> brace (heavy, slow) · <Kbd>1–4</Kbd> emotes · the more you're hit, the further you fly
          </p>
        )}
      </div>
    </div>
  );
}
