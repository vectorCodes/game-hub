// /games/prop-hunt: the landing page. A dollhouse cut open, with a seeker's flashlight
// sweeping the rooms and eyes blinking open on the furniture; a shelf of mugs to try the zap on
// (one of them is a hider); the two sides; and a round, to scale. The house itself is on /play.
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { HUNT_FORCED_TAUNT, HUNT_HIDE_SECONDS, HUNT_MAX_PLAYERS, HUNT_MIN_PLAYERS, HUNT_MISS_DAMAGE, HUNT_POINTS, HUNT_ROUND_RESULTS_MS, HUNT_SEEK_SECONDS } from "@shadow/shared";
import { Reveal } from "../../components/Reveal";
import { play } from "../../lib/sound";
import { PROP_HUNT_PATH } from "./config";

// Fixed print colours, like the hub covers: the drawing looks the same on any scheme.
const INK = "#2a2216";
const PAPER = "#f8f2e7";
const WOOD = "#9b7650";
const SUN = "#d9582c";
const JADE = "#2f8a73";
const GOLD = "#cc922f";

/** A pair of eyes that open, blink, and close again. `delay` staggers them through the house. */
function Eyes({ x, y, delay, size = 1 }: { x: number; y: number; delay: number; size?: number }) {
  return (
    <g className="ph-peek" style={{ animationDelay: `${delay}s` }}>
      <circle cx={x - 4.5 * size} cy={y} r={3.6 * size} fill="#fff" stroke={INK} strokeWidth="0.8" />
      <circle cx={x + 4.5 * size} cy={y} r={3.6 * size} fill="#fff" stroke={INK} strokeWidth="0.8" />
      <circle cx={x - 3.6 * size} cy={y + 0.6} r={1.7 * size} fill={INK} />
      <circle cx={x + 5.4 * size} cy={y + 0.6} r={1.7 * size} fill={INK} />
    </g>
  );
}

/** The hero drawing: the Big House cut open, four rooms, a seeker with a torch. */
function Dollhouse() {
  return (
    <svg viewBox="0 0 520 430" className="h-auto w-full drop-shadow-[0_30px_40px_rgba(60,45,20,0.25)]" role="img" aria-label="A house cut open like a dollhouse. Eyes peek out of a mug, a jar, a toy box and a rubber duck while a seeker sweeps a torch across the rooms.">
      <defs>
        <radialGradient id="ph-beam" cx="0" cy="0.5" r="1">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ph-ground">
          <rect x="50" y="244" width="420" height="150" />
        </clipPath>
      </defs>

      {/* Garden, roof and walls. */}
      <rect x="0" y="394" width="520" height="36" rx="4" fill="#6f9a4f" />
      <path d="M20 404 h480" stroke="#5d8a40" strokeWidth="3" strokeDasharray="2 7" />
      <rect x="388" y="30" width="26" height="50" fill={INK} />
      <polygon points="26,100 260,16 494,100" fill={INK} />
      <rect x="44" y="96" width="432" height="300" fill={PAPER} stroke={INK} strokeWidth="2.5" />

      {/* Rooms: bedroom and bathroom upstairs, living room and kitchen below. */}
      <rect x="50" y="102" width="206" height="132" fill="#efe2cb" />
      <rect x="264" y="102" width="206" height="132" fill="#e3edec" />
      <rect x="50" y="244" width="246" height="150" fill="#eedfc4" />
      <rect x="304" y="244" width="166" height="150" fill="#ebe5d8" />
      <rect x="44" y="234" width="432" height="10" fill={WOOD} />
      <rect x="256" y="102" width="8" height="132" fill={INK} fillOpacity="0.85" />
      <rect x="296" y="244" width="8" height="150" fill={INK} fillOpacity="0.85" />
      {/* Windows. */}
      {[
        [80, 120],
        [394, 120],
        [210, 262],
        [400, 262],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="40" height="30" fill="#cfe3f0" stroke={INK} strokeWidth="1.5" />
          <path d={`M${x + 20} ${y} v30 M${x} ${y + 15} h40`} stroke={INK} strokeWidth="1" />
        </g>
      ))}

      {/* Bedroom: a bed, a teddy, a toy box (someone's in it). */}
      <rect x="66" y="200" width="118" height="20" rx="3" fill="#dfe7ee" stroke={INK} strokeOpacity="0.4" />
      <rect x="62" y="186" width="10" height="44" fill={WOOD} />
      <rect x="66" y="220" width="6" height="12" fill={WOOD} />
      <rect x="178" y="220" width="6" height="12" fill={WOOD} />
      <circle cx="150" cy="192" r="10" fill="#9a6a43" />
      <circle cx="150" cy="178" r="7" fill="#9a6a43" />
      <rect x="198" y="208" width="44" height="26" fill={GOLD} stroke={INK} strokeOpacity="0.4" />
      <Eyes x={220} y={219} delay={0.6} />

      {/* Bathroom: a bath with ducks. */}
      <rect x="282" y="196" width="122" height="36" rx="10" fill="#fff" stroke={INK} strokeOpacity="0.4" />
      <circle cx="322" cy="192" r="8" fill="#f2c94c" />
      <circle cx="328" cy="184" r="5" fill="#f2c94c" />
      <circle cx="368" cy="192" r="8" fill="#f2c94c" />
      <circle cx="374" cy="184" r="5" fill="#f2c94c" />
      <Eyes x={368} y={193} delay={2.1} size={0.8} />
      <rect x="430" y="170" width="30" height="62" fill="#dfe6e4" stroke={INK} strokeOpacity="0.4" />

      {/* Living room: shelf of mugs, sofa, lamp. */}
      <rect x="66" y="292" width="120" height="6" fill={WOOD} />
      {[80, 104, 128, 152, 174].map((x, i) => (
        <rect key={x} x={x - 7} y="276" width="14" height="16" rx="2" fill={[PAPER, SUN, PAPER, JADE, PAPER][i]} stroke={INK} strokeOpacity="0.45" />
      ))}
      <Eyes x={128} y={283} delay={3.6} size={0.7} />
      <rect x="70" y="350" width="130" height="34" rx="6" fill="#6f8fa6" />
      <rect x="70" y="334" width="130" height="18" rx="5" fill="#5f7e94" />
      <rect x="246" y="306" width="4" height="80" fill={INK} />
      <path d="M232 306 h32 l-8 -20 h-16 z" fill="#efe3c4" stroke={INK} strokeOpacity="0.4" />

      {/* Kitchen: fridge, counter, jars. */}
      <rect x="426" y="300" width="36" height="94" rx="3" fill="#fff" stroke={INK} strokeOpacity="0.4" />
      <rect x="314" y="352" width="104" height="42" fill="#d9d3c7" stroke={INK} strokeOpacity="0.4" />
      {[330, 352, 374].map((x) => (
        <rect key={x} x={x - 8} y="334" width="16" height="18" rx="3" fill="#d6a24e" stroke={INK} strokeOpacity="0.4" />
      ))}
      <Eyes x={352} y={343} delay={4.8} size={0.75} />

      {/* The seeker, torch in hand, sweeping the living room. */}
      <g clipPath="url(#ph-ground)">
        <g className="ph-sweep" style={{ transformOrigin: "282px 352px" }}>
          <path d="M282 352 L60 270 L60 400 Z" fill="url(#ph-beam)" style={{ mixBlendMode: "multiply" }} />
        </g>
      </g>
      <circle cx="288" cy="340" r="8" fill={SUN} />
      <rect x="281" y="348" width="14" height="22" rx="4" fill={SUN} />
      <rect x="282" y="370" width="5" height="24" fill={INK} />
      <rect x="290" y="370" width="5" height="24" fill={INK} />
      <rect x="272" y="350" width="12" height="5" rx="2" fill={INK} />
    </svg>
  );
}

/** A mug on the teaser shelf; the hider is the same mug, just twitchier. */
function ShelfMug({ x, fill, state, twitch, onZap }: { x: number; fill: string; state: "idle" | "missed" | "found"; twitch: boolean; onZap: () => void }) {
  return (
    <g
      onClick={onZap}
      className={`cursor-crosshair ${state === "missed" ? "ph-wobble" : twitch && state === "idle" ? "ph-twitch" : ""}`}
      style={twitch ? { animationDelay: `${(x % 7) * 0.4}s` } : undefined}
      role="button"
      aria-label="Zap this mug"
    >
      <rect x={x - 22} y={64} width="44" height="54" rx="5" fill={fill} stroke={INK} strokeOpacity="0.45" strokeWidth="1.5" opacity={state === "missed" ? 0.45 : 1} />
      <path d={`M${x + 22} ${76} q16 0 16 13 q0 13 -16 13`} fill="none" stroke={fill} strokeWidth="7" opacity={state === "missed" ? 0.45 : 1} />
      {state === "found" && (
        <>
          <circle cx={x - 8} cy={88} r="6" fill="#fff" stroke={INK} />
          <circle cx={x + 8} cy={88} r="6" fill="#fff" stroke={INK} />
          <circle cx={x - 7} cy={89} r="2.6" fill={INK} />
          <circle cx={x + 9} cy={89} r="2.6" fill={INK} />
          <path d={`M${x - 6} 103 q6 -5 12 0`} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

const MUG_COLORS = [PAPER, SUN, PAPER, JADE, PAPER, GOLD, PAPER, SUN];

/** The teaser: one of these mugs is a player. Zap it. Misses cost health, like the real thing. */
function SpotTheHider() {
  const [round, setRound] = useState(0);
  const hider = useMemo(() => Math.floor(Math.random() * MUG_COLORS.length), [round]);
  const [missed, setMissed] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const hp = 100 - missed.length * HUNT_MISS_DAMAGE * 2;
  const out = hp <= 0;

  const zap = (i: number) => {
    if (found || out || missed.includes(i)) return;
    if (i === hider) {
      setFound(true);
      play("zapHit");
    } else {
      setMissed((m) => [...m, i]);
      play("zapMiss");
    }
  };
  const again = () => {
    setRound((r) => r + 1);
    setMissed([]);
    setFound(false);
  };

  const message = found
    ? `Found! ${missed.length === 0 ? "First try, sharp eyes." : `It took ${missed.length + 1} zaps.`}`
    : out
      ? "Too many misses: you're dizzy, and the hider got away."
      : "One of these mugs is a player. Watch closely, then click to zap it.";

  return (
    <div className="surface relative overflow-hidden rounded-sm p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`font-serif text-lg ${found ? "text-moss-300" : out ? "text-ember-400" : "text-stone-200"}`}>{message}</p>
        <div className="flex items-center gap-3">
          <span className="label-mono text-stone-400">{Math.max(0, hp)} HP</span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-[width] duration-300 ${hp > 40 ? "bg-moss-400" : "bg-ember-400"}`} style={{ width: `${Math.max(0, hp)}%` }} />
          </div>
        </div>
      </div>
      <svg viewBox="0 0 640 150" className="mt-4 w-full select-none">
        <rect x="10" y="118" width="620" height="12" rx="2" fill={WOOD} />
        <path d="M60 130 v16 h14 M580 130 v16 h-14" stroke={WOOD} strokeWidth="6" fill="none" />
        {MUG_COLORS.map((fill, i) => (
          <ShelfMug key={`${round}-${i}`} x={52 + i * 76} fill={fill} twitch={i === hider} state={found && i === hider ? "found" : missed.includes(i) ? "missed" : "idle"} onZap={() => zap(i)} />
        ))}
      </svg>
      {(found || out) && (
        <button onClick={again} className="btn btn-secondary mt-4">
          Hide again <span aria-hidden>↻</span>
        </button>
      )}
    </div>
  );
}

function Side({ tone, title, line, items }: { tone: "hider" | "seeker"; title: string; line: string; items: [string, ReactNode][] }) {
  const hider = tone === "hider";
  return (
    <div className={`relative overflow-hidden rounded-sm p-6 ring-1 sm:p-8 ${hider ? "bg-jade/10 ring-jade/30" : "bg-sun/10 ring-sun/30"}`}>
      <span aria-hidden className={`absolute -top-6 -right-4 font-display text-[7rem] leading-none font-bold opacity-[0.08] ${hider ? "text-jade" : "text-sun"}`}>
        {hider ? "?" : "⌖"}
      </span>
      <p className={`label-mono ${hider ? "text-jade" : "text-sun"}`}>{hider ? "Most of you" : "One or two of you"}</p>
      <h3 className="mt-2 font-display text-4xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 font-serif text-stone-400">{line}</p>
      <ul className="mt-6 space-y-3">
        {items.map(([key, what]) => (
          <li key={key} className="flex items-baseline gap-3">
            <kbd className={`min-w-14 shrink-0 rounded-xs px-2 py-1 text-center font-mono text-xs font-semibold text-white ${hider ? "bg-jade" : "bg-sun"}`}>{key}</kbd>
            <span className="font-serif text-stone-200">{what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROUND = [
  { label: "Hide", seconds: HUNT_HIDE_SECONDS, color: "bg-jade", note: "Seekers wait blindfolded" },
  { label: "Seek", seconds: HUNT_SEEK_SECONDS, color: "bg-sun", note: `Forced taunts in the last ${HUNT_FORCED_TAUNT.fromSecondsLeft} s` },
  { label: "Scores", seconds: HUNT_ROUND_RESULTS_MS / 1000, color: "bg-gold", note: "Next seeker up" },
];

const POINTS: [string, number][] = [
  ["Find a hider", HUNT_POINTS.find],
  [`…in the first ${HUNT_POINTS.quickSeconds} s`, HUNT_POINTS.quickFind],
  [`Stay hidden ${HUNT_POINTS.surviveEverySeconds} s`, HUNT_POINTS.survive],
  ["Survive the round", HUNT_POINTS.surviveRound],
  ["Taunt while seekers hunt", HUNT_POINTS.taunt],
  ["Last one found", HUNT_POINTS.lastStanding],
];

const clock = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`);

export default function PropHuntHome() {
  const total = ROUND.reduce((n, p) => n + p.seconds, 0);
  return (
    <div className="overflow-x-clip pb-24">
      {/* ---------- Hero: the house, cut open ---------- */}
      <section className="relative isolate overflow-hidden border-b hairline">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,rgba(204,146,47,0.16),transparent_60%)]" />
        <div className="container-page grid min-h-[calc(100svh-4rem)] items-center gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
          <div className="text-center lg:text-left">
            <p className="eyebrow inline-flex animate-rise items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sun" />
              Multiplayer hide &amp; seek · {HUNT_MIN_PLAYERS}–{HUNT_MAX_PLAYERS} friends
            </p>
            <h1 className="mt-5 animate-rise text-display [animation-delay:80ms]">
              Prop <span className="text-ember-400">Hunt</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg animate-rise text-lead [animation-delay:160ms] lg:mx-0">
              You're toy-sized in a huge house. Hide by becoming a mug, a book, a rubber duck. Or hunt your friends with a zapper and a hunch.
            </p>
            <div className="mx-auto mt-9 flex max-w-xs animate-rise flex-col items-stretch gap-3 [animation-delay:240ms] sm:max-w-none sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link to={`${PROP_HUNT_PATH}?friends=1`} className="btn btn-primary">
                Play with friends <span aria-hidden>→</span>
              </Link>
              <Link to={PROP_HUNT_PATH} className="btn btn-secondary">
                Explore the house alone
              </Link>
            </div>
            <dl className="mx-auto mt-10 grid max-w-md animate-rise grid-cols-3 border-y hairline py-4 [animation-delay:320ms] lg:mx-0">
              {[
                [`${HUNT_HIDE_SECONDS} s`, "to hide"],
                [clock(HUNT_SEEK_SECONDS), "to seek"],
                ["200+", "things to be"],
              ].map(([n, what]) => (
                <div key={what} className="text-center lg:text-left">
                  <dt className="font-display text-3xl font-bold tabular-nums">{n}</dt>
                  <dd className="label-mono text-stone-400">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mx-auto w-full max-w-xl animate-rise [animation-delay:200ms]">
            <Dollhouse />
            <p className="mt-3 text-center label-mono text-stone-400">Count the eyes. Then imagine you're the one with the torch.</p>
          </div>
        </div>
      </section>

      {/* ---------- Try the zap ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">Try it</p>
          <h2 className="mt-3 text-section">Spot the hider</h2>
          <p className="mt-4 max-w-2xl text-lead">Real props never move. Players can't help it.</p>
        </Reveal>
        <Reveal delay={90} className="mt-8">
          <SpotTheHider />
        </Reveal>
      </section>

      {/* ---------- Two sides ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">Two sides</p>
          <h2 className="mt-3 text-section">Blend in, or find what doesn't</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Reveal delay={60}>
            <Side
              tone="hider"
              title="Hiders"
              line="Run, pick a spot, become part of the furniture."
              items={[
                ["E", "Become whatever you're aiming at, at its real size"],
                ["Q", "Lock your rotation so you sit straight among your twins"],
                ["F", <>Taunt for points (and nerve). In the last minute you'll taunt anyway.</>],
                ["Space", "Hop. Toasters weren't made for it, which is the fun."],
              ]}
            />
          </Reveal>
          <Reveal delay={140}>
            <Side
              tone="seeker"
              title="Seekers"
              line="Wait in the garage, then hunt. Every find grows your team."
              items={[
                ["Click", <>Zap. A miss costs {HUNT_MISS_DAMAGE} health; ten and you're dizzy.</>],
                ["R", "Sonar, once a round: an arrow to the nearest hider"],
                ["Ears", "Listen for taunts: they come from where the hider is"],
                ["Found", "Every hider you find joins the hunt"],
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ---------- A round, to scale ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal>
          <p className="eyebrow">A round, to scale</p>
          <h2 className="mt-3 text-section">Everyone seeks once</h2>
          <p className="mt-4 max-w-2xl text-lead">A match is one round per player. Seekers rotate, so the score at the end is fair.</p>
        </Reveal>
        <Reveal delay={90} className="mt-8">
          <div className="flex h-12 overflow-hidden rounded-sm ring-1 ring-white/10">
            {ROUND.map((p) => (
              <div key={p.label} className={`${p.color} flex min-w-16 items-center px-3 font-mono text-xs font-semibold text-white uppercase`} style={{ flexGrow: p.seconds / total }}>
                {p.label} · {clock(p.seconds)}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 font-serif text-sm text-stone-400">
            {ROUND.map((p) => (
              <span key={p.label} className="min-w-16" style={{ flexGrow: p.seconds / total }}>
                {p.note}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={150} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POINTS.map(([what, n]) => (
            <div key={what} className="surface rounded-sm p-4">
              <div className="font-display text-3xl font-bold text-lamp-400 tabular-nums">+{n}</div>
              <div className="mt-1 font-serif text-sm text-stone-300">{what}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ---------- Way in ---------- */}
      <section className="container-page mt-16 sm:mt-24">
        <Reveal className="relative overflow-hidden rounded-sm bg-ink px-6 py-12 text-center text-[#f3ead9] sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,233,168,0.35),transparent)]" />
          <p className="relative label-mono text-[#cc922f]">Rooms of {HUNT_MIN_PLAYERS} to {HUNT_MAX_PLAYERS}</p>
          <h2 className="relative mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Get your friends in the house.</h2>
          <p className="relative mx-auto mt-3 max-w-lg font-serif text-[#f3ead9]/70">Make a room, send the code, and see who can stay a teapot the longest.</p>
          <Link to={`${PROP_HUNT_PATH}?friends=1`} className="btn btn-primary relative mt-8">
            Make a room <span aria-hidden>→</span>
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
