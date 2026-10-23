// /games/bumper-arena: the landing page. Bumper rings bobbing on the paper, today's
// Gauntlet, and how to play. The game itself is on /play (computers and tablets only).
import { useState } from "react";
import { Link } from "react-router";
import { BUMPER_MAPS, BUMPER_MODIFIERS, bumperDay } from "@shadow/shared";
import { Reveal } from "../../components/Reveal";
import { savedBest, savedDaily, today } from "./guest";
import { useBumperDaily } from "./HubCard";
import { isPhone } from "./ui/NoPhones";

const PLAY_PATH = "/games/bumper-arena/play";

/** Hero rings: [colour, left %, top %, size rem, wide only]. */
const HERO: [string, number, number, number, boolean][] = [
  ["#d9582c", 7, 16, 6, false],
  ["#2f8a73", 15, 64, 4.5, true],
  ["#cc922f", 82, 12, 5, false],
  ["#3d6f8f", 86, 62, 5.5, true],
  ["#8c4a6b", 72, 84, 3.5, false],
  ["#e2a940", 30, 6, 3.5, false],
  ["#4f7a72", 8, 86, 3.5, false],
];

const STEPS = [
  { title: "Drive", body: "Your ring slides and keeps its momentum. Steer with WASD, the arrow keys, or the stick on a tablet." },
  { title: "Dash", body: "A burst of speed with a short cooldown. Dash hits push hardest, but a miss can carry you off the edge." },
  { title: "Brace", body: "Hold to turn heavy and slow. Brace at the edge and they bounce off you instead." },
  { title: "Wobble", body: "Every hit you take raises your Wobble %. The higher it is, the further the next hit sends you flying." },
];

function Ring({ color, size, delay, className = "", style }: { color: string; size: number; delay: number; className?: string; style: React.CSSProperties }) {
  return (
    <div aria-hidden className={`absolute ${className}`} style={{ ...style, animation: `pp-bob ${6 + delay}s ease-in-out ${-delay}s infinite` }}>
      <div
        className="rounded-full shadow-[0_8px_0_rgba(42,34,22,0.25),0_22px_40px_-14px_rgba(60,45,20,0.5)]"
        style={{ width: `calc(${size}rem * var(--s))`, height: `calc(${size * 0.62}rem * var(--s))`, background: `radial-gradient(ellipse at 50% 45%, #2a2216 0 28%, ${color} 30% 100%)` }}
      />
    </div>
  );
}

export default function BumperArenaHome() {
  const board = useBumperDaily();
  const [phone] = useState(isPhone);
  const day = board?.day ?? bumperDay(today());
  const map = BUMPER_MAPS[day.map]?.name ?? day.map;
  const twist = BUMPER_MODIFIERS[day.modifier];
  const mine = savedDaily(day.date);
  const best = savedBest();
  const rank = board?.mine?.rank;

  return (
    <div className="overflow-x-clip pb-24">
      {/* ---------- Hero ---------- */}
      <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b hairline py-20 [--s:0.55] sm:py-16 sm:[--s:0.8] lg:[--s:1]">
        {HERO.map(([color, left, top, size, wide], i) => (
          <Ring key={i} color={color} size={size} delay={i * 0.7} className={wide ? "max-lg:hidden" : ""} style={{ left: `${left}%`, top: `${top}%`, opacity: size < 4 ? 0.75 : 1 }} />
        ))}

        <div className="container-page relative z-10 text-center">
          <p className="eyebrow inline-flex animate-rise items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-500" />
            Gauntlet #{day.number} is live{board?.players ? ` · ${board.players} played` : ""}
          </p>
          <h1 className="mt-5 animate-rise text-display [animation-delay:80ms]">
            Bumper <span className="text-ember-400">Arena</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-rise text-lead [animation-delay:160ms]">
            Sumo in bumper rings. Drive, dash and shove the bots off a floating arena. The last ring rolling wins.
          </p>

          <div className="mx-auto mt-9 flex max-w-xs animate-rise flex-col items-stretch justify-center gap-3 [animation-delay:240ms] sm:max-w-none sm:flex-row sm:items-center">
            {phone ? (
              <p className="inline-flex items-center gap-2 rounded-sm border hairline px-4 py-3 text-left font-serif text-sm text-stone-300">
                <span aria-hidden className="text-lg">💻</span>
                Bumper Arena is played on a computer or a tablet. Open it there to play.
              </p>
            ) : (
              <Link to={PLAY_PATH} className="btn btn-primary">
                {mine ? "Play again" : "Run today's Gauntlet"} <span aria-hidden>→</span>
              </Link>
            )}
          </div>

          <Link to="/leaderboard?game=bumper-arena" className="mt-6 inline-block animate-rise label-mono text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors [animation-delay:300ms] hover:text-stone-50">
            See the leaderboard →
          </Link>
          <br />
          {mine && (
            <div className="mx-auto mt-6 inline-flex max-w-full animate-rise flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y hairline px-4 py-2.5 font-serif text-sm text-stone-300 [animation-delay:320ms]">
              Today: {mine.waves} {mine.waves === 1 ? "wave" : "waves"} · {mine.kos} KOs · {mine.score} pts
              {rank ? <span className="font-semibold text-ember-400">· #{rank} today</span> : null}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Today's Gauntlet ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">Daily Gauntlet #{day.number}</p>
          <h2 className="mt-3 text-section">
            {map}, {twist.name}
          </h2>
          <p className="mt-4 max-w-2xl text-lead">
            {twist.blurb} Everyone gets the same arena and the same twist today. Bots come in waves, each one bigger and sharper than the last, and you have one life.
            Your first run of the day goes on the leaderboard.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
          {[
            ["Players today", board?.players ?? "—"],
            ["Best today", board ? `${board.best} waves` : "—"],
            ["Your best ever", best ? `${best} waves` : "—"],
          ].map(([label, value]) => (
            <Reveal key={label} className="surface p-5">
              <div className="label-mono text-stone-500">{label}</div>
              <div className="mt-2 font-display text-4xl font-light">{value}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- How to play ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">How to play</p>
          <h2 className="mt-3 text-section">Drive, dash, brace, bump</h2>
          <p className="mt-4 max-w-2xl text-lead">Practice is always open too: any arena, up to seven bots, easy to hard.</p>
        </Reveal>
        <div className="mt-8 grid gap-8 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="border-t hairline pt-6">
              <span className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-lamp-400 font-mono text-xs font-semibold text-lamp-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-2xl font-light uppercase">{s.title}</h3>
              <p className="mt-2 font-serif text-stone-400">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
