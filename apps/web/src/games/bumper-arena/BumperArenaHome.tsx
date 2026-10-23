// /games/bumper-arena: the landing page, on night. The hero is a live window onto the game
// (today's arena, five bots at it), then today's Gauntlet, the controls, the arenas, and the
// ways to play. The game itself is on /play (computers and tablets only).
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { BUMPER_MAPS, BUMPER_MAX_PLAYERS, BUMPER_MIN_PLAYERS, BUMPER_MODIFIERS, bumperDay } from "@shadow/shared";
import {
  GameHero,
  Kbd,
  LastCall,
  lastCallButton,
  LivePill,
  MetaLink,
  SectionHead,
  StatTiles,
  StepCards,
  TodayPanel,
  WayCards,
  type Step,
} from "../../components/landing";
import { Reveal } from "../../components/Reveal";
import { gsap, useGsap } from "../../lib/motion";
import { savedBest, savedDaily, today } from "./guest";
import { useBumperDaily } from "./HubCard";
import { roomsAvailable } from "./room";
import { game, useBumper } from "./store";
import { isPhone } from "./ui/NoPhones";

const Game = lazy(() => import("./scene/Game"));

const PLAY_PATH = "/games/bumper-arena/play";

/** Ring colours, as the riders wear them. */
const RINGS = ["#d9582c", "#2f8a73", "#cc922f", "#3d6f8f", "#8c4a6b"];

/** The live arena: today's map with five bots at it, drawing only while it's on screen. */
function LiveArena({ map }: { map: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(true);

  useEffect(() => {
    useBumper.getState().openMenu(map);
    return () => {
      // The bots' next-round timer checks `backdrop`; the play page's menu sets it again.
      useBumper.setState({ backdrop: false });
      game.sim = null;
      game.brains = [];
    };
  }, [map]);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setOnscreen(entry.isIntersecting));
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      <Suspense fallback={<StillArena />}>
        <Game preview paused={!onscreen} />
      </Suspense>
    </div>
  );
}

/** The arena drawn, for phones and for readers who asked for less motion: a gingham plate in the sky. */
function StillArena() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="ba-hero-gingham" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="#f3ead9" />
          <rect width="13" height="26" fill="#d9582c" fillOpacity="0.35" />
          <rect width="26" height="13" fill="#d9582c" fillOpacity="0.35" />
        </pattern>
      </defs>
      <rect width="400" height="260" fill="#cfe6ee" />
      <ellipse cx="200" cy="150" rx="160" ry="74" fill="#2a2216" fillOpacity="0.14" />
      <ellipse cx="200" cy="138" rx="160" ry="74" fill="url(#ba-hero-gingham)" stroke="#2a2216" strokeOpacity="0.3" />
      {RINGS.map((c, i) => {
        const [x, y] = [[150, 120], [236, 150], [196, 102], [276, 112], [128, 160]][i];
        return (
          <g key={c}>
            <ellipse cx={x} cy={y + 6} rx="22" ry="11" fill="#2a2216" fillOpacity="0.18" />
            <ellipse cx={x} cy={y} rx="22" ry="12" fill={c} />
            <ellipse cx={x} cy={y - 1} rx="10" ry="5" fill="#2a2216" fillOpacity="0.55" />
          </g>
        );
      })}
    </svg>
  );
}

const STEPS: Step[] = [
  {
    title: "Drive",
    body: "Your ring slides and keeps its momentum. Steer with WASD, the arrow keys, or the stick on a tablet.",
    visual: (
      <div className="grid grid-cols-3 gap-1.5">
        <span />
        <Kbd>W</Kbd>
        <span />
        <Kbd>A</Kbd>
        <Kbd>S</Kbd>
        <Kbd>D</Kbd>
      </div>
    ),
  },
  {
    title: "Dash",
    body: "A burst of speed with a short cooldown. Dash hits push hardest, but a miss can carry you off the edge.",
    visual: <Kbd wide>Space</Kbd>,
  },
  {
    title: "Brace",
    body: "Hold to turn heavy and slow. Brace at the edge and they bounce off you instead.",
    visual: <Kbd wide>Shift</Kbd>,
  },
  {
    title: "Wobble",
    body: "Every hit you take raises your Wobble %. The higher it is, the further the next hit sends you flying.",
    visual: (
      <div className="w-full max-w-44">
        <div className="h-3 overflow-hidden rounded-full bg-stone-800">
          <div data-wobble className="h-full origin-left rounded-full bg-gradient-to-r from-moss-400 via-lamp-400 to-ember-400" />
        </div>
        <div className="mt-2 flex justify-between label-mono text-stone-500">
          <span>0%</span>
          <span>Flying</span>
        </div>
      </div>
    ),
  },
];

/** Each arena, drawn from above in a few strokes. */
function ArenaMark({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-full" aria-hidden="true">
      <ellipse cx="60" cy="46" rx="50" ry="24" fill="#000" fillOpacity="0.3" />
      {kind === "hex" ? (
        <g fill="var(--accent)" fillOpacity="0.85" stroke="var(--n-950)" strokeWidth="2">
          {[
            [40, 36],
            [60, 30],
            [80, 36],
            [50, 46],
            [70, 46],
            [60, 56],
          ].map(([x, y]) => (
            <polygon key={`${x}-${y}`} points={`${x - 10},${y} ${x - 5},${y - 6} ${x + 5},${y - 6} ${x + 10},${y} ${x + 5},${y + 6} ${x - 5},${y + 6}`} />
          ))}
        </g>
      ) : (
        <ellipse cx="60" cy="40" rx="50" ry="24" fill={kind === "ice" ? "#cfeef7" : "var(--n-100)"} />
      )}
      {kind === "plate" && <ellipse cx="60" cy="40" rx="38" ry="17" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 5" />}
      {kind === "ice" && <path d="M30 34 l18 6 l14 -10 M64 44 l20 4" stroke="#7cc7dc" strokeWidth="2" fill="none" />}
      {kind === "spinner" && <rect x="18" y="37" width="84" height="6" rx="3" fill="var(--accent)" transform="rotate(-14 60 40)" />}
    </svg>
  );
}

export default function BumperArenaHome() {
  const board = useBumperDaily();
  const [phone] = useState(isPhone);
  const [still] = useState(() => phone || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const day = board?.day ?? bumperDay(today());
  const map = BUMPER_MAPS[day.map];
  const twist = BUMPER_MODIFIERS[day.modifier];
  const mine = savedDaily(day.date);
  const best = savedBest();
  const rank = board?.mine?.rank;
  const cta = mine ? "Play again" : "Run today's Gauntlet";

  // The wobble meter fills, holds, and drains, over and over, while it's in view.
  const howRef = useGsap<HTMLElement>((root, reduced) => {
    if (reduced) return;
    gsap.fromTo(
      "[data-wobble]",
      { scaleX: 0.04 },
      { scaleX: 1, duration: 2.6, ease: "power2.in", repeat: -1, repeatDelay: 0.5, scrollTrigger: { trigger: root, toggleActions: "play pause resume pause" } },
    );
  });

  return (
    <div className="relative overflow-x-clip pb-24">
      <GameHero
        pill={<LivePill>Gauntlet #{day.number} is live{board?.players ? ` · ${board.players} played` : ""}</LivePill>}
        title="Bumper"
        accent="Arena"
        lead={
          <>
            Sumo in bumper rings. Drive, dash and shove the bots, or {BUMPER_MIN_PLAYERS}–{BUMPER_MAX_PLAYERS} friends, off a floating arena. The last ring rolling wins.
          </>
        }
        actions={
          phone ? (
            <p className="surface inline-flex items-center gap-3 px-4 py-3 text-sm text-stone-300">
              <span aria-hidden className="text-lg">💻</span>
              Bumper Arena is played on a computer or a tablet. Open it there to play.
            </p>
          ) : (
            <>
              <Link to={PLAY_PATH} className="btn btn-primary">
                {cta} <span aria-hidden>→</span>
              </Link>
              {roomsAvailable && (
                <Link to={`${PLAY_PATH}?friends=1`} className="btn btn-secondary">
                  Play with friends
                </Link>
              )}
            </>
          )
        }
        meta={
          <>
            {mine && (
              <span>
                Today: <span className="text-stone-100">{mine.waves} {mine.waves === 1 ? "wave" : "waves"} · {mine.kos} KOs · {mine.score} pts</span>
                {rank ? <span className="font-semibold text-accent-text"> · #{rank}</span> : null}
              </span>
            )}
            <MetaLink to="/leaderboard?game=bumper-arena">See the leaderboard →</MetaLink>
          </>
        }
        screen={still ? <StillArena /> : <LiveArena map={day.map} />}
        screenGround="#cfe6ee"
        live={still ? "Today's arena" : "Live · bots only"}
        corner={map?.name}
        caption={`Twist · ${twist.name}`}
      />

      {/* ---------- Today's Gauntlet ---------- */}
      <section className="container-page mt-12 sm:mt-20">
        <TodayPanel
          aside={
            <StatTiles
              stacked
              stats={[
                ["Players today", board?.players],
                ["Best today", board?.best, " waves"],
                ["Your best ever", best, " waves"],
              ]}
            />
          }
        >
          <p className="eyebrow">Daily Gauntlet #{day.number}</p>
          <h2 className="mt-4 text-section">{map?.name}</h2>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 font-display text-sm font-bold text-accent-ink">
            Today&rsquo;s twist: {twist.name}
          </p>
          <p className="mt-6 max-w-xl text-lead">
            {twist.blurb} Everyone gets the same arena and the same twist today. Bots come in waves, each one bigger and sharper than the last, and you have one life.
          </p>
        </TodayPanel>
      </section>

      {/* ---------- How to play ---------- */}
      <section ref={howRef} className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow="How to play" title="Drive, dash, brace, bump" />
        <StepCards steps={STEPS} />
      </section>

      {/* ---------- Arenas ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow={`${Object.keys(BUMPER_MAPS).length} arenas`} title="Every floor fights back" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(BUMPER_MAPS).map((m, i) => {
            const isToday = m.id === day.map;
            return (
              <Reveal key={m.id} delay={i * 80} className={`surface relative p-6 ${isToday ? "shadow-glow ring-2 ring-accent" : ""}`}>
                {isToday && <span className="absolute top-4 right-4 rounded-full bg-accent px-2.5 py-1 label-mono text-accent-ink">Today</span>}
                <ArenaMark kind={m.id === "ice-floe" ? "ice" : m.kind} />
                <h3 className="mt-5 font-display text-2xl font-bold tracking-tight">{m.name}</h3>
                <p className="mt-2 text-stone-400">{m.blurb}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------- Ways to play ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow="Pick your fight" title="Alone, against the day, or with friends" />
        <WayCards
          playable={!phone}
          ways={[
            {
              title: "Daily Gauntlet",
              body: "One life against waves of bots, each bigger and sharper. Your first run of the day goes on the leaderboard.",
              to: PLAY_PATH,
              cta: mine ? "Play again" : "Run it",
            },
            { title: "Practice", body: "Any arena, up to seven bots, easy to hard. Pickups on or off. Always open.", to: PLAY_PATH, cta: "Practise" },
            ...(roomsAvailable
              ? [
                  {
                    title: "Party room",
                    body: `${BUMPER_MIN_PLAYERS}–${BUMPER_MAX_PLAYERS} friends, a few rounds, points for lasting and for every knockout. Share a code and go.`,
                    to: `${PLAY_PATH}?friends=1`,
                    cta: "Make a room",
                  },
                ]
              : []),
          ]}
        />
      </section>

      <LastCall
        title="Last ring rolling wins."
        action={
          !phone && (
            <Link to={PLAY_PATH} className={lastCallButton}>
              {cta} <span aria-hidden>→</span>
            </Link>
          )
        }
      >
        Gauntlet #{day.number} on {map?.name}, {day.modifier === "classic" ? "no twist, just the edge" : `with ${twist.name} on`}. Same arena for everyone, all day.
      </LastCall>
    </div>
  );
}
