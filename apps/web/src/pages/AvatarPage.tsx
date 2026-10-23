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

const AvatarStage = lazy(() => import("../avatar/AvatarStage"));

type Tab = "hair" | "skin" | "outfit" | "hat" | "eyewear";
const TABS: { value: Tab; number: string; label: string }[] = [
  { value: "hair", number: "01", label: "Hair" },
  { value: "skin", number: "02", label: "Skin" },
  { value: "outfit", number: "03", label: "Outfit" },
  { value: "hat", number: "04", label: "Hat" },
  { value: "eyewear", number: "05", label: "Eyes" },
];

const ICONS: Record<string, string> = {
  "hat:none": "—",
  "hat:cap": "🧢",
  "hat:beanie": "🧶",
  "hat:party": "🥳",
  "hat:cowboy": "🤠",
  "hat:tophat": "🎩",
  "hat:propeller": "🚁",
  "hat:crown": "👑",
  "hat:wizard": "🧙",
  "eyewear:none": "—",
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
    return `Sky Climb · ${a?.name ?? "achievement"}`;
  }
  if (item.shadowGuess) return `Shadow Guess · ${item.shadowGuess.label}`;
  return `${item.price} coins`;
}

/** A labelled group of options: a mono title and the current choice on the right. */
function Section({ title, current, children }: { title: string; current?: string; children: ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b hairline pb-2">
        <h3 className="label-mono text-stone-500">{title}</h3>
        {current && <span className="truncate font-display text-sm font-bold text-stone-100">{current}</span>}
      </div>
      {children}
    </div>
  );
}

/** Colour chips, with a tick and an accent ring on the chosen one. */
function Swatches({ swatches, value, onChange }: { swatches: Swatch[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2 min-[420px]:grid-cols-8 sm:grid-cols-10 md:grid-cols-8 lg:grid-cols-10">
      {swatches.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            aria-label={s.name}
            title={s.name}
            aria-pressed={on}
            className={`relative grid aspect-square place-items-center rounded-lg transition-transform duration-200 ease-mirai hover:-translate-y-0.5 ${
              on ? "scale-105 ring-2 ring-accent ring-offset-2 ring-offset-stone-950" : "ring-1 ring-white/10"
            }`}
            style={{ background: s.hex }}
          >
            {on && <span className="h-2 w-2 rounded-full bg-rice ring-1 ring-ink/40" />}
          </button>
        );
      })}
    </div>
  );
}

/** A style or item card: lit in the accent when chosen, dashed with its unlock route when locked. */
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
      className={`relative flex flex-col items-center overflow-hidden rounded-(--radius-ui) pt-1 pb-2.5 text-center transition duration-200 ease-mirai hover:-translate-y-0.5 ${
        locked ? "border border-dashed border-white/20" : selected ? "bg-accent/15 shadow-glow ring-2 ring-accent" : "surface"
      }`}
    >
      <span className={`mt-2 ${locked ? "opacity-40 grayscale" : ""}`}>{children}</span>
      <span className="mt-1 max-w-full truncate px-1.5 text-xs font-semibold">{label}</span>
      {note && <span className="mt-0.5 line-clamp-2 px-1.5 font-mono text-[9px] leading-tight tracking-wide text-accent-text uppercase">{note}</span>}
      {locked && <span className="absolute top-2 right-2 text-[10px]" title="Locked">🔒</span>}
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

  const swatchName = (list: Swatch[], id: string) => list.find((x) => x.id === id)?.name;

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
        <img src={`/sky-climb/portraits/character-${style}.png`} alt="" className="h-12 w-12 [image-rendering:pixelated] sm:h-14 sm:w-14" />
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
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-2xl sm:h-14 sm:w-14 sm:text-3xl">{ICONS[item.id]}</span>
        </Tile>
      );
    });

  const grid = "grid grid-cols-3 gap-2.5 min-[420px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5";
  const action =
    locked.length > 0 ? (
      buyable ? (
        <button onClick={() => void onBuy()} disabled={busy || !loaded} className="btn btn-primary w-full disabled:opacity-60">
          Unlock for {cost} coins
        </button>
      ) : (
        <p className="flex items-start gap-3 text-sm text-stone-300">
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span>
            Locked: {lockedItems.map((i) => `${i.name} (${howToGet(i)})`).join(", ")}. Earn it, then come back.
          </span>
        </p>
      )
    ) : (
      <button onClick={() => void onSave()} disabled={busy || !changed} className="btn btn-primary w-full disabled:opacity-50">
        {changed ? "Save avatar" : "Saved"}
      </button>
    );

  return (
    <div className="space-y-10 pb-28 md:pb-0">
      {/* ---------- Masthead ---------- */}
      <header className="flex animate-rise flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Player file · Fitting room</p>
          <h1 className="mt-3 text-display">Avatar</h1>
          <p className="mt-4 max-w-md text-lead">One look for every game: Sky Climb, your profile and the leaderboards.</p>
        </div>
        <div className="flex items-center gap-4">
          {back && (
            <Link to={back.to} className="font-display font-bold text-accent-text">
              ← {back.label}
            </Link>
          )}
          {/* Coins, as a glowing gold seal. */}
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gold text-ink shadow-[0_0_60px_-10px_var(--color-gold)] sm:h-28 sm:w-28">
            <div className="text-center">
              <div className="font-display text-2xl leading-none font-extrabold tracking-tight tabular-nums sm:text-4xl">{coins}</div>
              <div className="mt-1 font-mono text-[9px] font-semibold tracking-[0.16em] uppercase">Coins</div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10">
        {/* ---------- The stage ---------- */}
        <div className="relative isolate md:sticky md:top-20 md:self-start">
          <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-glow/20 blur-3xl" />
          <div className="relative aspect-square overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,#fbf4e6,#e8d9bd_80%)] shadow-glow-lg ring-1 ring-white/15">
            {/* A red sun behind the figure, a floor line beneath it. */}
            <span aria-hidden className="absolute top-[14%] left-1/2 h-[46%] w-[46%] -translate-x-1/2 rounded-full bg-sun/85" />
            <span aria-hidden className="absolute inset-x-[12%] bottom-[18%] h-px bg-ink/20" />
            <span className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 label-mono text-white backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-400" />
              Live preview
            </span>
            <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-ink/[0.03]" />}>
              <AvatarStage config={draft} />
            </Suspense>
            <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 label-mono text-white backdrop-blur-md">
              Drag to turn
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={randomize} className="btn btn-secondary">
              Randomize
            </button>
            <button onClick={() => set(saved)} disabled={!changed} className="btn btn-secondary disabled:opacity-40">
              Undo changes
            </button>
          </div>
        </div>

        {/* ---------- The options ---------- */}
        <div className="min-w-0">
          <nav role="tablist" aria-label="Avatar part" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = t.value === tab;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={`surface relative min-w-20 shrink-0 px-3 py-3 text-left transition-[box-shadow,transform] duration-300 ease-mirai sm:min-w-0 ${
                    active ? "shadow-[inset_0_0_0_2px_var(--accent)]" : "hover:-translate-y-0.5"
                  }`}
                >
                  <span className={`label-mono ${active ? "text-accent-text" : "text-stone-500"}`}>{t.number}</span>
                  <span className={`block font-display text-lg leading-tight font-bold tracking-tight ${active ? "text-stone-50" : "text-stone-400"}`}>{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div key={tab} className="mt-6 min-h-[22rem] animate-fade">
            {tab === "hair" && (
              <>
                <Section title="Hair colour" current={swatchName(HAIR_COLORS, draft.hair)}>
                  <Swatches swatches={HAIR_COLORS} value={draft.hair} onChange={(hair) => set({ hair })} />
                </Section>
                <Section title="Hair style & face" current={climbItem(`character:${draft.head}`)?.name}>
                  <div className={grid}>{AVATAR_STYLES.map((s) => styleTile(s, "head"))}</div>
                </Section>
              </>
            )}
            {tab === "skin" && (
              <Section title="Skin tone" current={swatchName(SKIN_TONES, draft.skin)}>
                <Swatches swatches={SKIN_TONES} value={draft.skin} onChange={(skin) => set({ skin })} />
              </Section>
            )}
            {tab === "outfit" && (
              <>
                <Section title="Top" current={swatchName(OUTFIT_COLORS, draft.top)}>
                  <Swatches swatches={OUTFIT_COLORS} value={draft.top} onChange={(top) => set({ top })} />
                </Section>
                <Section title="Bottoms" current={swatchName(OUTFIT_COLORS, draft.bottom)}>
                  <Swatches swatches={OUTFIT_COLORS} value={draft.bottom} onChange={(bottom) => set({ bottom })} />
                </Section>
                <Section title="Shoes" current={swatchName(OUTFIT_COLORS, draft.shoes)}>
                  <Swatches swatches={OUTFIT_COLORS} value={draft.shoes} onChange={(shoes) => set({ shoes })} />
                </Section>
                <Section title="Outfit style" current={climbItem(`character:${draft.body}`)?.name}>
                  <div className={grid}>{AVATAR_STYLES.map((s) => styleTile(s, "body"))}</div>
                </Section>
              </>
            )}
            {tab === "hat" && (
              <Section title="Hat" current={climbItem(draft.hat)?.name}>
                <div className={grid}>{itemTiles("hat")}</div>
              </Section>
            )}
            {tab === "eyewear" && (
              <Section title="Eyewear" current={climbItem(draft.eyewear)?.name}>
                <div className={grid}>{itemTiles("eyewear")}</div>
              </Section>
            )}
          </div>

          {/* Save / unlock: inline on wide screens, pinned to the bottom on phones. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t hairline bg-stone-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:mt-6 md:border-t md:bg-transparent md:px-0 md:pt-5 md:pb-0 md:backdrop-blur-none">
            {message && (
              <p className={`mb-2 text-sm font-semibold ${message.tone === "ok" ? "text-moss-400" : "text-ember-400"}`} role="status">
                {message.text}
              </p>
            )}
            {action}
          </div>

          {enabled && !user && (
            <div className="surface mt-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="flex items-center gap-3 text-sm text-stone-300">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
                Sign in to keep your avatar on every device.
              </p>
              <button onClick={() => void signIn()} className="btn btn-secondary">
                <GoogleIcon /> Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
