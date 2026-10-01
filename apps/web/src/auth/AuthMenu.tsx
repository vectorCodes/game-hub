import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Avatar } from "../components/Avatar";
import { useAuth } from "./store";

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 14l4-4-4-4M16 10H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const menuItem =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:outline-none";

export function AuthMenu() {
  const { enabled, user, me, synced, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Close on outside click, Escape, or navigation.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  if (!enabled) return null;

  if (!user) {
    return (
      <button
        onClick={() => {
          setRedirecting(true);
          // If the browser never leaves (popup blocked, network error), let them retry.
          signIn().catch(() => setRedirecting(false));
          setTimeout(() => setRedirecting(false), 8000);
        }}
        disabled={redirecting}
        className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-medium text-stone-900 shadow-sm transition hover:bg-stone-200 active:scale-95 disabled:cursor-wait disabled:opacity-80"
      >
        {redirecting ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" aria-hidden />
        ) : (
          <GoogleIcon />
        )}
        <span>{redirecting ? "Opening Google…" : "Sign in"}</span>
      </button>
    );
  }

  // The session already carries the Google profile, so the header never waits on /api/me.
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const name = me?.profile.displayName ?? meta.full_name ?? meta.name ?? user.email ?? "You";
  const avatar = me?.profile.avatarUrl ?? meta.avatar_url ?? meta.picture;
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={!synced}
        aria-label={`Account menu for ${name}`}
        className="flex h-9 items-center gap-2 rounded-full bg-white/5 py-1 pr-2.5 pl-1 text-stone-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
      >
        <span className="relative">
          <Avatar src={avatar} name={name} />
          {/* While guest games are linked and stats load: a quiet ring, not a label. */}
          {!synced && (
            <span aria-hidden className="absolute -inset-[3px] animate-spin rounded-full border-2 border-lamp-300/80 border-t-transparent border-r-transparent" />
          )}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-medium text-stone-100 md:inline">{name.split(" ")[0]}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div role="menu" className="glass absolute top-full right-0 z-40 mt-2 w-64 animate-pop rounded-2xl p-1.5 origin-top-right">
          <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
            <Avatar src={avatar} name={name} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-stone-50">{name}</div>
              {user.email && <div className="truncate text-xs text-stone-400">{user.email}</div>}
            </div>
          </div>
          <div className="my-1 h-px bg-white/[0.08]" />
          <Link role="menuitem" to="/profile" className={menuItem}>
            <ProfileIcon />
            Your profile
          </Link>
          <Link role="menuitem" to="/leaderboard" className={menuItem}>
            <TrophyIcon />
            Leaderboard
          </Link>
          <div className="my-1 h-px bg-white/[0.08]" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className={`${menuItem} text-ember-300 hover:text-ember-200`}
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 16.5c1.2-2.8 3.5-4.2 6.2-4.2s5 1.4 6.2 4.2" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M6 3.5h8v4a4 4 0 0 1-8 0v-4zM6 5H3.5a2.5 2.5 0 0 0 2.6 3.6M14 5h2.5a2.5 2.5 0 0 1-2.6 3.6M10 11.5V14M7 16.5h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
