// The locker: spend coins on climbers and trails, wear what you own, and see achievements.
import { useState } from "react";
import { Link } from "react-router";
import { CLIMB_ACHIEVEMENTS, CLIMB_ITEMS, type ClimbItem } from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { useAvatar } from "../../../avatar/store";
import { GoogleIcon } from "../../../auth/AuthMenu";
import { Segmented } from "../../../components/Segmented";
import { useClimb } from "../store";

type Tab = "character" | "gear" | "trail" | "achievements";

const TABS: { value: Tab; label: string }[] = [
  { value: "character", label: "Styles" },
  { value: "gear", label: "Hats & eyes" },
  { value: "trail", label: "Trails" },
  { value: "achievements", label: "Awards" },
];

const GEAR_ICONS: Record<string, string> = {
  "hat:none": "⭕",
  "hat:cap": "🧢",
  "hat:beanie": "🧶",
  "hat:party": "🥳",
  "hat:cowboy": "🤠",
  "hat:tophat": "🎩",
  "hat:propeller": "🚁",
  "hat:crown": "👑",
  "hat:wizard": "🧙",
  "eyewear:none": "⭕",
  "eyewear:glasses": "👓",
  "eyewear:sunglasses": "🕶️",
  "eyewear:goggles": "🥽",
};

/** How each trail looks in the shop. */
export const TRAIL_SWATCH: Record<string, string> = {
  "trail:none": "linear-gradient(135deg, #2a352d, #1a221c)",
  "trail:sparkle": "radial-gradient(circle at 30% 30%, #ffffff, #fdf1d3 30%, #9fb4ff 80%)",
  "trail:ember": "radial-gradient(circle at 40% 60%, #ffd27a, #ec7a5f 45%, #8a2b1a 90%)",
  "trail:rainbow": "conic-gradient(#ec7a5f, #f8cf72, #8fc76a, #7ec8ff, #d9a6ff, #ec7a5f)",
  "trail:gold": "radial-gradient(circle at 35% 35%, #fff6d2, #f8cf72 40%, #c97f26 90%)",
};

const ERRORS: Record<string, string> = {
  not_enough_coins: "Not enough coins yet. Keep climbing!",
  already_owned: "You already own that.",
  sign_in_required: "Sign in to spend your coins.",
};

export const portraitUrl = (itemId: string) => `/sky-climb/portraits/${itemId.replace(":", "-")}.png`;

/** Who wears what: trails in Sky Climb's loadout; hats and eyewear on the avatar. */
function useWorn(item: ClimbItem): [boolean, () => void] {
  const loadout = useClimb((s) => s.profile.loadout);
  const equip = useClimb((s) => s.equip);
  const avatar = useAvatar((s) => s.config);
  const saveAvatar = useAvatar((s) => s.save);
  if (item.kind === "trail") return [loadout.trail === item.id, () => void equip(item.id)];
  if (item.kind === "hat" || item.kind === "eyewear") {
    return [avatar[item.kind] === item.id, () => void saveAvatar({ ...avatar, [item.kind]: item.id })];
  }
  // Styles go on in the avatar editor (hair from one, outfit from another).
  return [avatar.head === item.id.replace("character:", "") || avatar.body === item.id.replace("character:", ""), () => {}];
}

function ItemCard({ item }: { item: ClimbItem }) {
  const profile = useClimb((s) => s.profile);
  const buy = useClimb((s) => s.buy);
  const loadAvatar = useAvatar((s) => s.load);
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worn, wear] = useWorn(item);
  const owned = profile.owned.includes(item.id);
  const achievement = item.achievement ? CLIMB_ACHIEVEMENTS.find((a) => a.id === item.achievement) : null;
  const earned = achievement ? `🏅 ${achievement.name}` : item.shadowGuess ? `🔦 ${item.shadowGuess.label}` : null;
  const affordable = profile.coins.balance >= item.price;
  const isStyle = item.kind === "character";

  const onClick = async () => {
    setError(null);
    if (owned) return wear();
    if (earned) return;
    setBusy(true);
    const code = await buy(item.id);
    setBusy(false);
    if (code) setError(ERRORS[code] ?? "Couldn't buy that right now.");
    else void loadAvatar();
  };

  return (
    <button
      onClick={() => void onClick()}
      disabled={busy || (worn && !isStyle) || (!owned && !!earned) || (owned && isStyle)}
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center ring-1 transition ${
        worn ? "bg-lamp-300/15 ring-lamp-300/50" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"
      } ${!owned ? "opacity-90" : ""}`}
    >
      {isStyle ? (
        <img src={portraitUrl(item.id)} alt="" className={`h-14 w-14 [image-rendering:pixelated] ${owned ? "" : "grayscale-[0.6]"}`} />
      ) : item.kind === "trail" ? (
        <span className="h-14 w-14 rounded-full ring-2 ring-white/15" style={{ background: TRAIL_SWATCH[item.id] }} />
      ) : (
        <span className={`grid h-14 w-14 place-items-center text-3xl ${owned ? "" : "grayscale-[0.6]"}`}>{GEAR_ICONS[item.id]}</span>
      )}
      <span className="text-sm font-medium">{item.name}</span>
      <span className={`text-xs ${worn ? "text-lamp-200" : owned ? "text-moss-300" : affordable ? "text-stone-200" : "text-stone-500"}`}>
        {isStyle && owned ? (worn ? "In your avatar" : "Owned") : worn ? "Wearing" : owned ? "Wear" : earned ?? (busy ? "Buying…" : `🪙 ${item.price}`)}
      </span>
      {!owned && !achievement && !user && <span className="sr-only">Sign in to buy</span>}
      {error && <span className="absolute inset-x-1 -bottom-1 translate-y-full rounded-lg bg-ember-500/90 px-2 py-1 text-[11px] text-white">{error}</span>}
    </button>
  );
}

function Achievements() {
  const achievements = useClimb((s) => s.profile.achievements);
  const done = achievements.filter((a) => a.unlocked).length;
  return (
    <div>
      <p className="mb-3 text-sm text-stone-400">
        {done} of {achievements.length} unlocked
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CLIMB_ACHIEVEMENTS.map((def) => {
          const a = achievements.find((x) => x.id === def.id)!;
          return (
            <li key={def.id} className={`flex gap-3 rounded-2xl p-3 ring-1 ${a.unlocked ? "bg-moss-500/10 ring-moss-400/30" : "bg-white/[0.03] ring-white/10"}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${a.unlocked ? "bg-moss-400/20" : "bg-white/5 grayscale"}`}>{def.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{def.name}</span>
                  {a.unlocked && <span className="text-xs text-moss-300">✓</span>}
                </div>
                <p className="text-xs text-stone-400">{def.description}</p>
                {!a.unlocked && a.target > 1 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-lamp-400" style={{ width: `${(a.progress / a.target) * 100}%` }} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Locker() {
  const open = useClimb((s) => s.lockerOpen);
  const setOpen = useClimb((s) => s.setLockerOpen);
  const coins = useClimb((s) => s.profile.coins);
  const { enabled, user, signIn } = useAuth();
  const [tab, setTab] = useState<Tab>("character");
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-stone-950/60 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="glass flex max-h-full w-full max-w-2xl animate-pop flex-col rounded-[1.75rem] p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Locker</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Gear up</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-lamp-300/15 px-3 py-1.5 font-display font-semibold text-lamp-200 tabular-nums ring-1 ring-lamp-300/30">
              🪙 {coins.balance}
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close locker" className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-white/10">
              ✕
            </button>
          </div>
        </div>

        <Segmented className="mt-5" label="Locker section" options={TABS} value={tab} onChange={setTab} />

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 pb-8">
          {tab === "achievements" ? (
            <Achievements />
          ) : (
            <>
              {tab === "character" && (
                <p className="mb-3 text-sm text-stone-400">
                  A style unlocks its hair and its outfit for your avatar. Mix them in the{" "}
                  <Link to="/avatar?from=sky-climb" className="text-moss-300 hover:underline">
                    avatar editor →
                  </Link>
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {CLIMB_ITEMS.filter((i) => (tab === "gear" ? i.kind === "hat" || i.kind === "eyewear" : i.kind === tab)).map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>

        {enabled && !user && (
          <button
            onClick={() => void signIn()}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 hover:bg-white/10"
          >
            <GoogleIcon /> Sign in to spend coins and keep them on every device
          </button>
        )}
        <p className="mt-3 text-center text-xs text-stone-500">Collect coins while you climb. Everything here is just for looks.</p>
      </div>
    </div>
  );
}
