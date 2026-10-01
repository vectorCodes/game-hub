import { Link } from "react-router";
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

export function AuthMenu() {
  const { enabled, user, me, synced, signIn, signOut } = useAuth();
  if (!enabled) return null;

  if (!user) {
    return (
      <button
        onClick={() => void signIn()}
        className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-stone-900 shadow-sm transition hover:bg-stone-200 active:scale-95"
      >
        <GoogleIcon />
        <span>Sign in</span>
      </button>
    );
  }

  // The session already carries the Google profile, so the header doesn't wait on /api/me.
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const name = me?.profile.displayName ?? meta.full_name ?? meta.name ?? user.email ?? "You";
  const avatar = me?.profile.avatarUrl ?? meta.avatar_url ?? meta.picture;
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/5 py-1 pr-1 pl-1 ring-1 ring-white/10">
      <Link to="/profile" className="flex items-center gap-2 rounded-full pr-2 transition hover:text-white">
        <Avatar src={avatar} name={name} />
        <span className="hidden max-w-32 truncate text-sm text-stone-200 md:inline">
          {synced ? name.split(" ")[0] : "Signing in…"}
        </span>
      </Link>
      <button
        onClick={() => void signOut()}
        title="Sign out"
        aria-label="Sign out"
        className="grid h-7 w-7 place-items-center rounded-full text-stone-400 transition hover:bg-white/10 hover:text-white"
      >
        <SignOutIcon />
      </button>
    </div>
  );
}
