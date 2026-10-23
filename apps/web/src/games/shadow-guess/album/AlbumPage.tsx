// /album: the Shadow Album, a collection catalogue on night. A masthead with a progress ring
// and an index of categories, then each category's plates: numbered specimen cards (lit
// paper, like the wall the shadows fall on) for the objects found, dashed placeholders for
// the ones still hidden.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AlbumCategory, AlbumEntry, AlbumView } from "@shadow/shared";
import { api } from "../../../api/client";
import { GoogleIcon } from "../../../auth/AuthMenu";
import { useAuth } from "../../../auth/store";
import { ShadowScene } from "../scene/ShadowScene";
import { REVEAL_ANGLE } from "../scene/angles";
import { solvedSessionIds } from "../store";
import { SHADOW_GUESS_PATH } from "../useDaily";
import { thumbnail } from "./thumbnails";

const plate = (n: number) => `No. ${String(n).padStart(3, "0")}`;
const slug = (name: string) => `cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** The share of the collection found, as a ring that fills in the accent. */
function ProgressRing({ found, total }: { found: number; total: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const r = 52;
  const c = 2 * Math.PI * r;
  const share = total ? found / total : 0;
  return (
    <div className="relative h-32 w-32 shrink-0 sm:h-40 sm:w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={grown ? c * (1 - share) : c}
          className="transition-[stroke-dashoffset] duration-1000 ease-mirai [filter:drop-shadow(0_0_6px_var(--glow))]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-4xl leading-none font-extrabold tracking-tight tabular-nums sm:text-5xl">{found}</div>
          <div className="mt-1 label-mono text-stone-500">of {total}</div>
        </div>
      </div>
    </div>
  );
}

function FoundPlate({ entry, number, onOpen }: { entry: AlbumEntry; number: number; onOpen: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    thumbnail(entry.modelUrl).then(
      (url) => live && setSrc(url),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [entry.modelUrl]);

  return (
    <li>
      <button
        onClick={onOpen}
        className="group block w-full overflow-hidden rounded-(--radius-ui) bg-paper-soft text-left text-ink transition duration-300 ease-mirai hover:-translate-y-1 hover:shadow-glow"
      >
        <div className="relative aspect-square bg-wall">
          {src ? (
            <img src={src} alt="" className="h-full w-full animate-fade object-cover transition duration-500 ease-mirai group-hover:scale-105" />
          ) : (
            <div className="h-full w-full animate-pulse bg-ink/5" />
          )}
          <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.12em] text-ink/55 uppercase">{plate(number)}</span>
          {entry.bestAngle === 1 && <span title="Solved on the first angle" className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-sun" />}
        </div>
        <div className="border-t border-ink/10 px-2.5 py-2 sm:px-3">
          <div className="truncate font-display text-sm font-bold tracking-tight">{entry.name}</div>
          <div className="truncate font-mono text-[10px] tracking-[0.08em] text-ink/55 uppercase">
            Angle {entry.bestAngle}
            {entry.solves > 1 && ` · ×${entry.solves}`}
          </div>
        </div>
      </button>
    </li>
  );
}

function LockedPlate({ number }: { number: number }) {
  return (
    <li aria-hidden className="overflow-hidden rounded-(--radius-ui) border border-dashed border-white/15">
      <div className="relative grid aspect-square place-items-center">
        <span className="font-display text-4xl font-extrabold text-stone-700">?</span>
        <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.12em] text-stone-600 uppercase">{plate(number)}</span>
      </div>
      <div className="border-t border-dashed border-white/20 px-2.5 py-2 sm:px-3">
        <div className="text-sm text-stone-600">Still in shadow</div>
        <div className="font-mono text-[10px] text-stone-700">· · ·</div>
      </div>
    </li>
  );
}

function CategorySection({ category, index, firstPlate, onOpen }: { category: AlbumCategory; index: number; firstPlate: number; onOpen: (e: AlbumEntry) => void }) {
  const found = category.found.length;
  const locked = Math.max(0, category.total - found);
  const complete = category.total > 0 && found === category.total;
  return (
    <section id={slug(category.name)} className="scroll-mt-24">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b hairline pb-3">
        <div>
          <div className="label-mono text-accent-text">{String(index + 1).padStart(2, "0")}</div>
          <h2 className="mt-2 flex items-center gap-3 font-display text-3xl leading-none font-bold tracking-tight sm:text-4xl">
            {category.name}
            {complete && <span className="rounded-full bg-accent px-2.5 py-1 label-mono text-accent-ink">Complete</span>}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
            <div className="h-full rounded-full bg-accent" style={{ width: `${category.total ? (found / category.total) * 100 : 0}%` }} />
          </div>
          <span className="label-mono text-stone-400 tabular-nums">
            {found}/{category.total}
          </span>
        </div>
      </header>
      <ul className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {category.found.map((entry, i) => (
          <FoundPlate key={entry.id} entry={entry} number={firstPlate + i} onOpen={() => onOpen(entry)} />
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <LockedPlate key={i} number={firstPlate + found + i} />
        ))}
      </ul>
    </section>
  );
}

/** A solved object up close, as a plate: the 3D object to turn, and its record. */
function Viewer({ entry, category, onClose }: { entry: AlbumEntry; category: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = new Date(entry.firstSolvedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const facts = [
    ["Best", `Angle ${entry.bestAngle}`],
    ["Solved", `${entry.solves} ${entry.solves === 1 ? "time" : "times"}`],
    ["First", first],
  ];
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={entry.name}
      onClick={onClose}
      className="fixed inset-0 z-50 grid animate-fade place-items-end overflow-y-auto bg-ink/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg animate-rise overflow-hidden rounded-t-[1.75rem] bg-paper text-ink shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] sm:rounded-[1.75rem]"
      >
        <div className="relative aspect-[4/3] bg-wall">
          <ShadowScene modelUrl={entry.modelUrl} angle={REVEAL_ANGLE} revealed orbit />
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-paper/85 px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-ink uppercase">
            Drag to rotate
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-paper/90 text-ink transition hover:bg-ink hover:text-paper"
          >
            ✕
          </button>
        </div>
        <div className="p-5 sm:p-6">
          <div className="font-mono text-[10px] tracking-[0.14em] text-sun uppercase">{category}</div>
          <h3 className="mt-1 font-display text-3xl font-bold tracking-tight">{entry.name}</h3>
          <dl className="mt-4 grid grid-cols-3 border-y border-ink/15">
            {facts.map(([label, value], i) => (
              <div key={label} className={`py-3 ${i ? "border-l border-ink/15 pl-3" : ""}`}>
                <dt className="font-mono text-[10px] tracking-[0.12em] text-ink/50 uppercase">{label}</dt>
                <dd className="mt-1 text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

export default function AlbumPage() {
  const { enabled, user, synced, signIn } = useAuth();
  const [album, setAlbum] = useState<AlbumView | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<{ entry: AlbumEntry; category: string } | null>(null);

  // Wait for sign-in state, then load (again when the player signs in or out).
  const authKey = synced ? (user?.id ?? "guest") : null;
  useEffect(() => {
    if (!authKey) return;
    let live = true;
    setFailed(false);
    api<AlbumView>("/api/shadow-guess/album", { body: { sessionIds: solvedSessionIds() } }).then(
      (a) => live && setAlbum(a),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [authKey]);

  if (failed) {
    return <p className="py-16 text-center text-stone-400">Couldn't load your album. Try again in a moment.</p>;
  }
  if (!album) {
    return (
      <div className="space-y-10">
        <div className="flex items-end justify-between gap-6 pb-8">
          <div className="h-16 w-72 max-w-[60%] animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="h-32 w-32 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-(--radius-ui) bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  // Categories with finds first, then by how complete they are.
  const categories = [...album.categories].sort(
    (a, b) => b.found.length / (b.total || 1) - a.found.length / (a.total || 1) || a.name.localeCompare(b.name),
  );
  // Plates are numbered through the whole catalogue, in this order.
  const firstPlates = categories.reduce<number[]>((acc, c, i) => [...acc, i ? acc[i - 1] + categories[i - 1].total : 1], []);
  const completeCount = categories.filter((c) => c.total > 0 && c.found.length === c.total).length;

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ---------- Masthead ---------- */}
      <header className="surface relative animate-rise overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Shadow Album · The collection</p>
            <h1 className="mt-3 text-display">Album</h1>
            <p className="mt-4 max-w-md text-lead">Every object you've named from its shadow, catalogued. Solve a daily to add the next plate.</p>
          </div>
          <ProgressRing found={album.found} total={album.total} />
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 label-mono text-stone-500">
          <span>{categories.length} categories</span>
          <span>{completeCount} complete</span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sun" /> Solved on the first angle
          </span>
        </div>
      </header>

      {/* ---------- Index ---------- */}
      {album.found > 0 && (
        <nav aria-label="Categories" className="-mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:-mt-6 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <a
              key={c.name}
              href={`#${slug(c.name)}`}
              className="shrink-0 rounded-full px-3.5 py-2 label-mono text-stone-300 ring-1 ring-white/15 transition-colors hover:bg-accent hover:text-accent-ink hover:ring-accent"
            >
              {c.name} <span className="text-stone-500">{c.found.length}/{c.total}</span>
            </a>
          ))}
        </nav>
      )}

      {enabled && !user && (
        <div className="surface flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="flex items-center gap-3 text-stone-300">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
            Sign in to keep your album on every device.
          </p>
          <button onClick={() => void signIn()} className="btn btn-primary">
            <GoogleIcon /> Sign in
          </button>
        </div>
      )}

      {album.found === 0 && (
        <div className="surface grid place-items-center py-16 text-center">
          <span aria-hidden className="h-14 w-14 rounded-full ring-2 ring-accent" />
          <h2 className="mt-6 text-section">An empty album</h2>
          <p className="mt-3 max-w-sm text-lead">Solve a shadow and its object becomes your first plate.</p>
          <Link to={SHADOW_GUESS_PATH} className="btn btn-primary mt-8">
            Play Shadow Guess <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {categories.map((c, i) => (
        <CategorySection key={c.name} category={c} index={i} firstPlate={firstPlates[i]} onOpen={(entry) => setOpen({ entry, category: c.name })} />
      ))}

      {open && <Viewer entry={open.entry} category={open.category} onClose={() => setOpen(null)} />}
    </div>
  );
}
