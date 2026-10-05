// /avatar: build your GameHub avatar. Hair style and colour, skin, outfit and its colours,
// a hat and eyewear. Worn in Sky Climb, the header, your profile and on leaderboards.
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
  AVATAR_STYLES,
  CLIMB_ACHIEVEMENTS,
  CLIMB_ITEMS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  avatarKey,
  climbItem,
  type AvatarConfig,
  type ClimbItem,
  type Swatch,
} from "@shadow/shared";
import { GoogleIcon } from "../auth/AuthMenu";
import { useAuth } from "../auth/store";
import { useAvatar } from "../avatar/store";
import { Segmented } from "../components/Segmented";

const AvatarStage = lazy(() => import("../avatar/AvatarStage"));

type Tab = "hair" | "skin" | "outfit" | "hat" | "eyewear";
const TABS: { value: Tab; label: string }[] = [
  { value: "hair", label: "Hair" },
  { value: "skin", label: "Skin" },
  { value: "outfit", label: "Outfit" },
  { value: "hat", label: "Hat" },
  { value: "eyewear", label: "Eyes" },
];

const ICONS: Record<string, string> = {
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

const ERRORS: Record<string, string> = {
  not_enough_coins: "Not enough coins yet: climb in Sky Climb to earn more.",
  sign_in_required: "Sign in to spend coins.",
  already_owned: "You already own that.",
};

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** How a locked item is unlocked, in a few words. */
function howToGet(item: ClimbItem): string {
  if (item.achievement) {
    const a = CLIMB_ACHIEVEMENTS.find((x) => x.id === item.achievement);
    return `Sky Climb: ${a?.name ?? "achievement"}`;
  }
  if (item.shadowGuess) return `Shadow Guess: ${item.shadowGuess.label}`;
  return `🪙 ${item.price}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Swatches({ swatches, value, onChange }: { swatches: Swatch[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          aria-label={s.name}
          title={s.name}
          aria-pressed={s.id === value}
          className={`h-9 w-9 rounded-full ring-2 transition ${s.id === value ? "scale-110 ring-lamp-300" : "ring-white/15 hover:ring-white/40"}`}
          style={{ background: `linear-gradient(160deg, ${s.hex} 55%, color-mix(in srgb, ${s.hex} 70%, black))` }}
        />
      ))}
    </div>
  );
}

function Tile({
  selected,
  locked,
  label,
  note,
  onClick,
  children,
}: {
  selected: boolean;
  locked: boolean;
  label: string;
  note?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-1 rounded-2xl p-2.5 text-center ring-1 transition ${
        selected ? "bg-lamp-300/15 ring-lamp-300/60" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"
      }`}
    >
      <span className={locked ? "opacity-45 grayscale" : ""}>{children}</span>
      <span className="text-xs font-medium">{label}</span>
      {note && <span className={`text-[10px] leading-tight ${locked ? "text-lamp-200" : "text-stone-500"}`}>{note}</span>}
      {locked && <span className="absolute top-1.5 right-1.5 text-xs">🔒</span>}
    </button>
  );
}

export default function AvatarPage() {
  const saved = useAvatar((s) => s.config);
  const owned = useAvatar((s) => s.owned);
  const coins = useAvatar((s) => s.coins);
  const loaded = useAvatar((s) => s.loaded);
  const save = useAvatar((s) => s.save);
  const buy = useAvatar((s) => s.buy);
  const { enabled, user, signIn } = useAuth();
  const [params] = useSearchParams();
  const back = params.get("from") === "sky-climb" ? { to: "/games/sky-climb/play", label: "Back to Sky Climb" } : null;

  const [draft, setDraft] = useState<AvatarConfig>(saved);
  const [tab, setTab] = useState<Tab>("hair");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  // Start from the saved avatar once it has loaded.
  useEffect(() => setDraft(saved), [saved]);

  const has = (id: string) => owned.includes(id);
  const changed = avatarKey(draft) !== avatarKey(saved);
  const locked = [
    !has(`character:${draft.head}`) && `character:${draft.head}`,
    !has(`character:${draft.body}`) && `character:${draft.body}`,
    !has(draft.hat) && draft.hat,
    !has(draft.eyewear) && draft.eyewear,
  ].filter(Boolean) as string[];

  const set = (patch: Partial<AvatarConfig>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const randomize = () => {
    const styles = AVATAR_STYLES.filter((s) => has(`character:${s}`));
    const hats = CLIMB_ITEMS.filter((i) => i.kind === "hat" && has(i.id));
    const eyes = CLIMB_ITEMS.filter((i) => i.kind === "eyewear" && has(i.id));
    set({
      head: pick(styles),
      body: pick(styles),
      skin: pick(SKIN_TONES).id,
      hair: pick(HAIR_COLORS).id,
      top: pick(OUTFIT_COLORS).id,
      bottom: pick(OUTFIT_COLORS).id,
      shoes: pick(OUTFIT_COLORS).id,
      // Mostly bare-headed, sometimes not.
      hat: Math.random() < 0.5 ? "hat:none" : pick(hats).id,
      eyewear: Math.random() < 0.6 ? "eyewear:none" : pick(eyes).id,
    });
  };

  const onSave = async () => {
    setBusy(true);
    const code = await save(draft);
    setBusy(false);
    setMessage(code ? { text: "Couldn't save that. Try again.", tone: "error" } : { text: "Saved! You'll wear it everywhere.", tone: "ok" });
  };

  /** Buys every locked item in the draft (they're all shown with their prices). */
  const onBuy = async () => {
    setBusy(true);
    for (const id of locked) {
      const code = await buy(id);
      if (code) {
        setBusy(false);
        setMessage({ text: ERRORS[code] ?? "Couldn't buy that right now.", tone: "error" });
        return;
      }
    }
    setBusy(false);
    setMessage({ text: "Unlocked! Now save your look.", tone: "ok" });
  };

  const lockedItems = locked.map((id) => climbItem(id)!).filter(Boolean);
  const buyable = lockedItems.every((i) => i.price > 0 && !i.achievement && !i.shadowGuess);
  const cost = lockedItems.reduce((n, i) => n + i.price, 0);

  const styleTile = (style: (typeof AVATAR_STYLES)[number], field: "head" | "body") => {
    const item = climbItem(`character:${style}`)!;
    const isLocked = !has(item.id);
    return (
      <Tile
        key={style}
        selected={draft[field] === style}
        locked={isLocked}
        label={item.name}
        note={isLocked ? howToGet(item) : undefined}
        onClick={() => set({ [field]: style })}
      >
        <img src={`/sky-climb/portraits/character-${style}.png`} alt="" className="h-12 w-12 [image-rendering:pixelated]" />
      </Tile>
    );
  };

  const itemTiles = (kind: "hat" | "eyewear") =>
    CLIMB_ITEMS.filter((i) => i.kind === kind).map((item) => {
      const isLocked = !has(item.id);
      return (
        <Tile
          key={item.id}
          selected={draft[kind] === item.id}
          locked={isLocked}
          label={item.name}
          note={isLocked ? howToGet(item) : undefined}
          onClick={() => set({ [kind]: item.id })}
        >
          <span className="grid h-12 w-12 place-items-center text-3xl">{ICONS[item.id]}</span>
        </Tile>
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">GameHub</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your avatar</h1>
          <p className="mt-1 text-sm text-stone-400">One look for every game: Sky Climb, your profile, the leaderboards.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-lamp-300/15 px-3 py-1.5 font-display font-semibold text-lamp-200 tabular-nums ring-1 ring-lamp-300/30">
            🪙 {coins}
          </span>
          {back && (
            <Link to={back.to} className="btn btn-secondary h-9! px-4! text-sm">
              ← {back.label}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,#2a3a2f,#0e1411_75%)] ring-1 ring-white/10 md:sticky md:top-20 md:self-start">
          <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-white/[0.02]" />}>
            <AvatarStage config={draft} />
          </Suspense>
          <div className="absolute inset-x-3 bottom-3 flex gap-2">
            <button onClick={randomize} className="btn btn-secondary h-10! flex-1 text-sm backdrop-blur-md">
              🎲 Randomize
            </button>
            <button onClick={() => set(saved)} disabled={!changed} className="btn btn-secondary h-10! text-sm backdrop-blur-md disabled:opacity-40">
              Undo
            </button>
          </div>
        </div>

        <div className="surface flex min-h-0 flex-col p-4 sm:p-5">
          <Segmented label="Avatar part" options={TABS} value={tab} onChange={setTab} />
          <div className="mt-5 min-h-[22rem]">
            {tab === "hair" && (
              <>
                <Section title="Hair colour">
                  <Swatches swatches={HAIR_COLORS} value={draft.hair} onChange={(hair) => set({ hair })} />
                </Section>
                <Section title="Hair style & face">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{AVATAR_STYLES.map((s) => styleTile(s, "head"))}</div>
                </Section>
              </>
            )}
            {tab === "skin" && (
              <Section title="Skin tone">
                <Swatches swatches={SKIN_TONES} value={draft.skin} onChange={(skin) => set({ skin })} />
              </Section>
            )}
            {tab === "outfit" && (
              <>
                <Section title="Top">
                  <Swatches swatches={OUTFIT_COLORS} value={draft.top} onChange={(top) => set({ top })} />
                </Section>
                <Section title="Bottoms">
                  <Swatches swatches={OUTFIT_COLORS} value={draft.bottom} onChange={(bottom) => set({ bottom })} />
                </Section>
                <Section title="Shoes">
                  <Swatches swatches={OUTFIT_COLORS} value={draft.shoes} onChange={(shoes) => set({ shoes })} />
                </Section>
                <Section title="Outfit style">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{AVATAR_STYLES.map((s) => styleTile(s, "body"))}</div>
                </Section>
              </>
            )}
            {tab === "hat" && (
              <Section title="Hat">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{itemTiles("hat")}</div>
              </Section>
            )}
            {tab === "eyewear" && (
              <Section title="Eyewear">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{itemTiles("eyewear")}</div>
              </Section>
            )}
          </div>

          <div className="mt-2 space-y-3 border-t border-white/[0.08] pt-4">
            {message && (
              <p className={`text-sm ${message.tone === "ok" ? "text-moss-300" : "text-ember-300"}`} role="status">
                {message.text}
              </p>
            )}
            {locked.length > 0 ? (
              buyable ? (
                <button onClick={() => void onBuy()} disabled={busy || !loaded} className="btn btn-primary w-full disabled:opacity-60">
                  🔓 Unlock for 🪙 {cost}
                </button>
              ) : (
                <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-stone-300 ring-1 ring-white/10">
                  🔒 {lockedItems.map((i) => `${i.name} (${howToGet(i)})`).join(", ")}. Earn it, then come back!
                </p>
              )
            ) : (
              <button onClick={() => void onSave()} disabled={busy || !changed} className="btn btn-primary w-full disabled:opacity-50">
                {changed ? "Save avatar" : "Saved"}
              </button>
            )}
            {enabled && !user && (
              <button
                onClick={() => void signIn()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 hover:bg-white/10"
              >
                <GoogleIcon /> Sign in to keep your avatar on every device
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
