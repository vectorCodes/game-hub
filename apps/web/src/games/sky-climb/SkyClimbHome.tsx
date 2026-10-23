// /games/sky-climb: the landing page, on night. The hero is a live window onto today's
// tower, then today's climb, the zones from meadow to deep space, how it works, and today's
// highest climbers. The 3D climb itself is on /play.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { TWISTS } from "@shadow/shared";
import { GameHero, Kbd, LastCall, lastCallButton, LivePill, SectionHead, StatTiles, StepCards, TodayPanel } from "../../components/landing";
import { Reveal } from "../../components/Reveal";
import { formatCountdown, formatDuration } from "../../lib/format";
import { useNow } from "../shadow-guess/useDaily";
import { FLOORS, MOON, SKY_CLIMB_PATH, TOP, ZONES } from "./config";
import { SkyClimbCover } from "./HubCard";
import { dailySeed, localBest, useClimb } from "./store";
import { towerTwist } from "./twists";

const Game = lazy(() => import("./scene/Game"));

const STEPS = [
  {
    title: "Run and jump",
    body: "Arrow keys or WASD, and Space to jump. On phones, a joystick and a big jump button.",
    visual: (
      <div className="flex items-end gap-3">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <Kbd>W</Kbd>
          <span />
          <Kbd>A</Kbd>
          <Kbd>S</Kbd>
          <Kbd>D</Kbd>
        </div>
        <Kbd wide>Space</Kbd>
      </div>
    ),
  },
  { title: "Checkpoints", body: "Fall off and you're back at the last flag, not the bottom. Every fall is counted.", visual: <span className="text-6xl">🚩</span> },
  { title: "Daily tower", body: "Everyone climbs the same tower each day. Highest floor wins; time breaks ties.", visual: <span className="text-6xl">🏆</span> },
];

function zoneRange(i: number) {
  const z = ZONES[i];
  const end = ZONES[i + 1] ? ZONES[i + 1].from - 1 : TOP;
  if (end === z.from) return `Floor ${z.from}`;
  return `Floors ${Math.max(1, z.from)}–${end}`;
}

/** Today's tower, live: the climber at its foot, the camera swaying round. Draws only while on screen. */
function LiveTower() {
  const ref = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setOnscreen(entry.isIntersecting));
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      <Suspense fallback={null}>
        <Game preview paused={!onscreen} />
      </Suspense>
    </div>
  );
}

export default function SkyClimbHome() {
  const daily = useClimb((s) => s.daily);
  const loadDaily = useClimb((s) => s.loadDaily);
  const setMode = useClimb((s) => s.setMode);
  const now = useNow();
  const best = localBest("daily");
  const twist = towerTwist(dailySeed());
  // Phones get the drawing: the live tower is a whole game's worth of GPU.
  const [still] = useState(() => window.matchMedia("(max-width: 768px), (pointer: coarse), (prefers-reduced-motion: reduce)").matches);
  const cta = best > 0 ? `Beat floor ${best}` : "Climb today's tower";

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  return (
    <div className="relative overflow-x-clip pb-24">
      <GameHero
        pill={<LivePill>{daily ? `Tower #${daily.number} · next in ${formatCountdown(daily.nextAt, now)}` : "A new tower every day"}</LivePill>}
        title="Sky"
        accent="Climb"
        lead={
          <>
            One tower a day. Don&rsquo;t look down. Jump from meadow to storm to the summit at floor {FLOORS}, through space to the Moon at {MOON}, then on into deep
            space to floor {TOP}.
          </>
        }
        actions={
          <>
            <Link to={SKY_CLIMB_PATH} onClick={() => setMode("daily")} className="btn btn-primary">
              {cta} <span aria-hidden>↑</span>
            </Link>
            <Link to={SKY_CLIMB_PATH} onClick={() => setMode("practice")} className="btn btn-secondary">
              Practice
            </Link>
          </>
        }
        meta={
          <>
            {twist && (
              <span>
                {TWISTS[twist].emoji} Today&rsquo;s twist: <span className="text-stone-100">{TWISTS[twist].name}</span>
              </span>
            )}
            <span>{daily?.climbers ? `${daily.climbers} climbing today · ` : ""}Free · No sign-up needed</span>
          </>
        }
        screen={still ? <SkyClimbCover /> : <LiveTower />}
        screenGround="#d3e2da"
        live={still ? undefined : "Live · today's tower"}
        corner={still ? undefined : `Floor 1 of ${TOP}`}
        caption={still || !twist ? undefined : `Twist · ${TWISTS[twist].name}`}
      />

      {/* ---------- Today's tower ---------- */}
      <section className="container-page mt-12 sm:mt-20">
        <TodayPanel
          aside={
            <StatTiles
              stacked
              stats={[
                ["Climbing today", daily?.climbers],
                ["Highest today", daily?.top[0]?.floor, " fl"],
                ["Your best", best, " fl"],
              ]}
            />
          }
        >
          <p className="eyebrow">{daily ? `Tower #${daily.number}` : "Today's tower"}</p>
          <h2 className="mt-4 text-section">Same tower for everyone</h2>
          {twist && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 font-display text-sm font-bold text-accent-ink">
              {TWISTS[twist].emoji} Today&rsquo;s twist: {TWISTS[twist].name}
            </p>
          )}
          <p className="mt-6 max-w-xl text-lead">
            {twist ? `${TWISTS[twist].blurb}. ` : ""}Highest floor wins, time breaks ties.{daily ? ` A new tower in ${formatCountdown(daily.nextAt, now)}.` : ""}
          </p>
        </TodayPanel>
      </section>

      {/* ---------- The tower ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow={`${ZONES.length} zones · ${TOP} floors`} title="Easy at the bottom. Brutal at the top.">
          Every zone changes the view and the rules. The jumps get longer, the platforms smaller, and the sky darker. Past the summit, gravity loosens its grip. Past
          the Moon, a black hole starts to pull.
        </SectionHead>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ZONES.map((z, i) => (
            <Reveal key={z.id} delay={(i % 3) * 70} className="surface overflow-hidden">
              <div className="relative flex h-24 items-end justify-between px-6 pb-3" style={{ background: `linear-gradient(${z.sky.top}, ${z.sky.bottom})` }}>
                <span className="text-4xl drop-shadow-[0_2px_6px_rgb(0_0_0/0.25)]">{z.emoji}</span>
                <span className="rounded-full bg-black/45 px-2.5 py-1 label-mono text-white backdrop-blur-sm">{zoneRange(i)}</span>
              </div>
              <div className="p-6">
                <h3 className="font-display text-2xl font-bold tracking-tight">{z.name}</h3>
                <p className="mt-2 text-stone-400">{z.blurb}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow="How it works" title="Jump. Fall. Climb again." />
        <StepCards steps={STEPS} />
      </section>

      {/* ---------- Today's highest ---------- */}
      <section className="container-page mt-24 sm:mt-32">
        <SectionHead eyebrow="Leaderboard" title="Today&rsquo;s highest climbers" />
        <Reveal className="surface mt-10 p-4 sm:p-6">
          {daily?.top.length ? (
            <ol className="space-y-1.5">
              {daily.top.slice(0, 8).map((e) => (
                <li
                  key={`${e.rank}-${e.name}`}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${e.isMe ? "bg-accent/15 ring-1 ring-accent/40" : "bg-white/[0.03]"}`}
                >
                  <span className="flex items-center gap-4">
                    <span className={`w-6 font-display text-xl font-extrabold tabular-nums ${e.rank <= 3 ? "text-accent-text" : "text-stone-500"}`}>{e.rank}</span>
                    {e.name}
                  </span>
                  <span className="tabular-nums text-stone-300">
                    Floor <span className="font-display text-lg font-bold text-stone-50">{e.floor}</span>{" "}
                    <span className="text-stone-500">· {formatDuration(e.seconds)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-2 py-4 text-stone-400">Nobody&rsquo;s on the board yet today. Climb first and it&rsquo;s yours.</p>
          )}
          <Link to="/leaderboard?game=sky-climb" className="mt-4 block px-2 text-sm text-stone-400 transition-colors hover:text-stone-100">
            This week and all-time leaderboards →
          </Link>
        </Reveal>
      </section>

      <LastCall
        title="Don&rsquo;t look down."
        action={
          <Link to={SKY_CLIMB_PATH} onClick={() => setMode("daily")} className={lastCallButton}>
            {cta} <span aria-hidden>↑</span>
          </Link>
        }
      >
        {TOP} floors, one tower, the same for everyone today. How high can you get?
      </LastCall>
    </div>
  );
}
