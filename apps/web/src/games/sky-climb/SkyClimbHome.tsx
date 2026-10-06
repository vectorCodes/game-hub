// /games/sky-climb: the game's landing page. The 3D climb itself is on /play.
import { useEffect } from "react";
import { Link } from "react-router";
import { TWISTS } from "@shadow/shared";
import { Reveal } from "../../components/Reveal";
import { formatCountdown, formatDuration } from "../../lib/format";
import { useNow } from "../shadow-guess/useDaily";
import { FLOORS, SKY_CLIMB_PATH, ZONES } from "./config";
import { SkyClimbCover } from "./HubCard";
import { dailySeed, localBest, useClimb } from "./store";
import { towerTwist } from "./twists";

const STEPS = [
  { emoji: "🕹️", title: "Run and jump", body: "Arrow keys or WASD and Space. On phones, a joystick and a big jump button." },
  { emoji: "🚩", title: "Checkpoints", body: "Fall off and you're back at the last flag, not the bottom. Every fall is counted." },
  { emoji: "🏆", title: "Daily tower", body: "Everyone climbs the same tower each day. Highest floor wins; time breaks ties." },
];

function zoneRange(i: number) {
  const z = ZONES[i];
  const next = ZONES[i + 1];
  if (!next) return `Floor ${z.from}`;
  return `Floors ${Math.max(1, z.from)}–${next.from - 1}`;
}

export default function SkyClimbHome() {
  const daily = useClimb((s) => s.daily);
  const loadDaily = useClimb((s) => s.loadDaily);
  const setMode = useClimb((s) => s.setMode);
  const now = useNow();
  const best = localBest("daily");
  const twist = towerTwist(dailySeed());

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  return (
    <div className="pb-24">
      <section className="container-page grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
        <div className="text-center md:text-left">
          <p className="eyebrow animate-rise">{daily ? `Tower #${daily.number} · next in ${formatCountdown(daily.nextAt, now)}` : "A new tower every day"}</p>
          <h1 className="mt-4 animate-rise text-display [animation-delay:80ms]">
            Sky{" "}
            <span className="bg-gradient-to-r from-lamp-200 via-lamp-300 to-lamp-500 bg-clip-text text-transparent">Climb</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md animate-rise text-lead [animation-delay:160ms] md:mx-0">
            One tower a day. Don&rsquo;t look down. Jump from meadow to storm to the stars: {FLOORS} floors, harder the higher you go.
          </p>
          {twist && (
            <p className="mt-5 inline-flex animate-rise items-center gap-2 rounded-full bg-violet-400/15 px-4 py-1.5 text-sm font-medium text-violet-100 ring-1 ring-violet-300/30 [animation-delay:200ms]">
              <span className="text-lg">{TWISTS[twist].emoji}</span>
              Today&rsquo;s twist: {TWISTS[twist].name}
              <span className="text-violet-200/70">· {TWISTS[twist].blurb}</span>
            </p>
          )}
          <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:240ms] sm:flex-row max-md:justify-center">
            <Link to={SKY_CLIMB_PATH} onClick={() => setMode("daily")} className="btn btn-primary">
              {best > 0 ? `Beat floor ${best}` : "Climb today's tower"} <span aria-hidden>↑</span>
            </Link>
            <Link to={SKY_CLIMB_PATH} onClick={() => setMode("practice")} className="btn btn-secondary">
              Practice
            </Link>
          </div>
          <p className="mt-4 animate-rise text-sm text-stone-400 [animation-delay:300ms]">
            {daily?.climbers ? `${daily.climbers} climbing today · ` : ""}Free · No sign-up needed
          </p>
        </div>
        <div className="animate-rise [animation-delay:200ms]">
          <SkyClimbCover />
        </div>
      </section>

      <section className="container-page py-16">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">The tower</p>
          <h2 className="mt-4 text-section">Easy at the bottom. Brutal at the top.</h2>
          <p className="mt-4 text-lead">Every zone changes the view and the rules. The jumps get longer, the platforms smaller, and the sky darker.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ZONES.map((z, i) => (
            <Reveal key={z.id} delay={i * 70} className="surface p-6">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{z.emoji}</span>
                <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{zoneRange(i)}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{z.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{z.blurb}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-4 text-section">Jump. Fall. Climb again.</h2>
            </Reveal>
            <div className="mt-8 space-y-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 80} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-2xl ring-1 ring-white/10">{s.emoji}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-stone-400">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={120} className="surface p-6 sm:p-7">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Today&rsquo;s highest climbers</p>
            {daily?.top.length ? (
              <ol className="mt-4 space-y-1.5 text-sm">
                {daily.top.slice(0, 8).map((e) => (
                  <li key={`${e.rank}-${e.name}`} className={`flex justify-between rounded-xl px-3 py-2 ${e.isMe ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.03]"}`}>
                    <span>
                      <span className="mr-2 text-stone-500 tabular-nums">{e.rank}</span>
                      {e.name}
                    </span>
                    <span className="tabular-nums text-stone-300">
                      Floor {e.floor} <span className="text-stone-500">· {formatDuration(e.seconds)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-stone-400">Nobody&rsquo;s on the board yet today. Climb first and it&rsquo;s yours.</p>
            )}
            <Link to={SKY_CLIMB_PATH} onClick={() => setMode("daily")} className="btn btn-primary mt-6 w-full">
              Start climbing <span aria-hidden>↑</span>
            </Link>
            <Link to="/leaderboard?game=sky-climb" className="mt-3 block text-center text-sm text-stone-400 hover:text-stone-200">
              This week and all-time leaderboards →
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
