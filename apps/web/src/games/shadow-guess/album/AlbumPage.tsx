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

function Progress({ found, total, className = "" }: { found: number; total: number; className?: string }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-lamp-300 to-lamp-500 transition-[width] duration-700 ease-out"
        style={{ width: grown && total ? `${(found / total) * 100}%` : "0%" }}
      />
    </div>
  );
}

function FoundTile({ entry, onOpen }: { entry: AlbumEntry; onOpen: () => void }) {
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
        className="group block w-full overflow-hidden rounded-2xl bg-white/[0.04] text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-lamp-400/50"
      >
        <div className="aspect-square bg-wall">
          {src ? (
            <img src={src} alt="" className="h-full w-full animate-fade object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="h-full w-full animate-pulse bg-stone-300/30" />
          )}
        </div>
        <div className="px-2.5 py-2">
          <div className="truncate text-sm font-medium text-white">{entry.name}</div>
          <div className="text-xs text-stone-400 tabular-nums">
            Angle {entry.bestAngle}
            {entry.solves > 1 && ` · ×${entry.solves}`}
          </div>
        </div>
      </button>
    </li>
  );
}

function LockedTile() {
  return (
    <li aria-hidden className="overflow-hidden rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.06]">
      <div className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.05),transparent_60%)]">
        <span className="font-display text-3xl font-bold text-stone-700">?</span>
      </div>
      <div className="px-2.5 py-2">
        <div className="h-3.5 w-2/3 rounded bg-white/[0.05]" />
        <div className="mt-1.5 h-3 w-1/3 rounded bg-white/[0.03]" />
      </div>
    </li>
  );
}

function CategorySection({ category, onOpen }: { category: AlbumCategory; onOpen: (e: AlbumEntry) => void }) {
  const found = category.found.length;
  const locked = Math.max(0, category.total - found);
  const complete = category.total > 0 && found === category.total;
  return (
    <section className="animate-rise">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold">{category.name}</h2>
        {complete && (
          <span className="rounded-full bg-lamp-400/15 px-2 py-0.5 text-xs font-semibold text-lamp-300 ring-1 ring-lamp-400/30">
            ★ Complete
          </span>
        )}
        <span className="ml-auto text-sm text-stone-400 tabular-nums">
          {found}/{category.total}
        </span>
      </header>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
        {category.found.map((entry) => (
          <FoundTile key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <LockedTile key={i} />
        ))}
      </ul>
    </section>
  );
}

/** A solved object up close: drag to turn it. */
function Viewer({ entry, category, onClose }: { entry: AlbumEntry; category: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = new Date(entry.firstSolvedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={entry.name}
      onClick={onClose}
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-stone-950/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg animate-rise overflow-hidden rounded-3xl bg-stone-900 ring-1 ring-white/10"
      >
        <div className="relative aspect-square bg-wall sm:aspect-[4/3]">
          <ShadowScene modelUrl={entry.modelUrl} angle={REVEAL_ANGLE} revealed orbit />
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-950/75 px-3 py-1 text-xs text-stone-100 ring-1 ring-white/10">
            Drag to rotate
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <div className="text-xs font-medium tracking-wide text-stone-400 uppercase">{category}</div>
            <h3 className="font-display text-2xl font-bold">{entry.name}</h3>
            <p className="mt-1 text-sm text-stone-400">
              Best: angle {entry.bestAngle} · solved {entry.solves} {entry.solves === 1 ? "time" : "times"} · first on {first}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-stone-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
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
      <div className="grid min-h-[40vh] place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-lamp-400" />
      </div>
    );
  }

  // Categories with finds first, then by how complete they are.
  const categories = [...album.categories].sort(
    (a, b) => b.found.length / (b.total || 1) - a.found.length / (a.total || 1) || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Shadow Album</h1>
        <p className="mt-1 text-stone-400">Every object you've named from its shadow.</p>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold text-lamp-300 text-glow tabular-nums">{album.found}</span>
          <span className="text-stone-400 tabular-nums">of {album.total} found</span>
        </div>
        <Progress found={album.found} total={album.total} className="mt-3" />
      </div>

      {enabled && !user && (
        <button
          onClick={() => void signIn()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.04] py-3 text-sm text-stone-200 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
        >
          <GoogleIcon />
          Sign in to keep your album on every device
        </button>
      )}

      {album.found === 0 && (
        <div className="rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-white/10">
          <p className="text-stone-300">Your album is empty. Solve a shadow to add your first object.</p>
          <Link to={SHADOW_GUESS_PATH} className="mt-4 inline-block rounded-2xl btn-primary px-5 py-2.5 font-semibold">
            Play Shadow Guess →
          </Link>
        </div>
      )}

      {categories.map((c) => (
        <CategorySection key={c.name} category={c} onOpen={(entry) => setOpen({ entry, category: c.name })} />
      ))}

      {open && <Viewer entry={open.entry} category={open.category} onClose={() => setOpen(null)} />}
    </div>
  );
}
