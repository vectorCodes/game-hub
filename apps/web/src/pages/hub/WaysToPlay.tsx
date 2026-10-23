import { Link } from "react-router";
import { HUNT_MAX_PLAYERS, ROOM_MAX_PLAYERS } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { Reveal } from "../../components/Reveal";
import { games } from "../../games/registry";

const WAYS = [
  {
    name: "Guest",
    count: "0",
    unit: "sign-ups",
    lines: ["Every game, every daily", "Progress kept in this browser", "No install, no ads"],
  },
  {
    name: "Signed in",
    count: "1",
    unit: "account, every game",
    lines: ["Daily streaks and stats", "One avatar, one coin balance", "Guest progress moves in on sign-in"],
    featured: true,
  },
  {
    name: "With friends",
    count: `${HUNT_MAX_PLAYERS}`,
    unit: "players a room",
    lines: [`Prop Hunt rooms up to ${HUNT_MAX_PLAYERS}`, `Sky Climb races, 1–${ROOM_MAX_PLAYERS} players`, "Beat-my-climb challenge links"],
  },
];

/** Three ways to play. Each card carries its reach as a set of orbit rings, one per step out. */
export function WaysToPlay() {
  const { enabled, user, signIn } = useAuth();
  const [first] = games;
  const ctas = [
    <Link to={first.path}>Play as a guest</Link>,
    enabled && !user ? <button type="button" onClick={() => void signIn()}>Sign in with Google</button> : <Link to="/profile">Open your profile</Link>,
    <Link to="/games/sky-climb">Race in Sky Climb</Link>,
  ];

  return (
    <section id="ways" aria-labelledby="ways-title" className="container-page py-28 md:py-40">
      <Reveal className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Ways to play</p>
          <h2 id="ways-title" className="mt-4 text-section">
            Three ways in.
          </h2>
        </div>
        <p className="label-mono text-stone-500">Every game is free · Sign-in is optional</p>
      </Reveal>

      <ol className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
        {WAYS.map((w, i) => (
          <li key={w.name} className="h-full">
            <Reveal delay={i * 110} className="h-full">
              <div
                className={`group relative flex h-full flex-col overflow-hidden p-6 transition-[transform,box-shadow] duration-500 ease-mirai hover:-translate-y-1.5 md:p-8 ${
                  w.featured ? "surface shadow-[inset_0_0_0_2px_var(--accent)] hover:shadow-[inset_0_0_0_2px_var(--accent),0_30px_80px_-30px_color-mix(in_oklch,var(--glow)_55%,transparent)]" : "surface"
                }`}
              >
                {/* Orbit rings: one per step out, from you to your friends. */}
                <svg aria-hidden viewBox="0 0 200 200" className="absolute -top-10 -right-10 size-48 text-stone-100/12 transition-transform duration-[1.2s] group-hover:rotate-45">
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <ellipse key={k} cx="100" cy="100" rx={40 + k * 18} ry={18 + k * 8} fill="none" stroke="currentColor" transform={`rotate(${-20 + k * 14} 100 100)`} />
                  ))}
                  <circle cx="100" cy="100" r="9" fill="#d9582c" opacity="0.6" />
                </svg>

                {w.featured && <span className="self-start rounded-full bg-accent px-2.5 py-1 label-mono text-accent-ink">Recommended</span>}
                <h3 className={`font-display text-2xl font-bold tracking-tight ${w.featured ? "mt-5" : ""}`}>{w.name}</h3>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-[4rem] leading-none font-extrabold tracking-tight">{w.count}</span>
                  <span className="label-mono text-stone-500">{w.unit}</span>
                </p>
                <ul className="mt-8 space-y-2.5 border-t hairline pt-6">
                  {w.lines.map((l) => (
                    <li key={l} className="flex gap-3 text-stone-300">
                      <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-accent" />
                      {l}
                    </li>
                  ))}
                </ul>
                <div className={`mt-10 flex *:w-full ${w.featured ? "*:btn *:btn-primary" : "*:btn *:btn-secondary"}`}>{ctas[i]}</div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
