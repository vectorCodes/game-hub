import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router";
import HubHome from "./pages/hub/HubHome";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import { AuthMenu } from "./auth/AuthMenu";
import { useAuth } from "./auth/store";
import { useAvatarSync } from "./avatar/store";
import { Logo } from "./components/Logo";
import { games, playPath } from "./games/registry";

// Lazy: the album and the avatar editor draw 3D models, so they bring three.js with them.
const Album = lazy(() => import("./games/shadow-guess/album/AlbumPage"));
const AvatarPage = lazy(() => import("./pages/AvatarPage"));

/** Pages that are a single night scene end to end. None today: the whole site is paper. */
const NIGHT_PAGES = new Set<string>();

// Compiled out of production builds.
const AnglePicker = import.meta.env.DEV ? lazy(() => import("./pages/dev/AnglePicker")) : null;

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group relative inline-flex min-h-11 shrink-0 items-center px-2 whitespace-nowrap transition-colors sm:px-3 ${
          isActive ? "text-stone-50" : "text-stone-400 hover:text-stone-50"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {/* A dot under the current page, as in print navigation. */}
          <span
            aria-hidden
            className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current transition-[opacity,transform] duration-200 ${
              isActive ? "opacity-100" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-stone-950/85 backdrop-blur-xl">
      <nav className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <span className="hidden font-mono text-xs leading-none font-semibold tracking-[0.12em] uppercase md:inline">Game&nbsp;Hub</span>
        </Link>
        {/* Phones: the links scroll sideways if they ever don't fit, the account menu stays put. */}
        <div className="flex min-w-0 items-center gap-0.5 font-mono text-[10px] font-medium tracking-[0.12em] uppercase sm:gap-1 sm:text-[11px]">
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
            {/* Short names until there's room for every full title (tablets get the short ones). */}
            {games.map((g) => (
              <NavItem key={g.id} to={g.path}>
                <span className="lg:hidden">{g.shortTitle}</span>
                <span className="hidden lg:inline">{g.title}</span>
              </NavItem>
            ))}
            <NavItem to="/album">Album</NavItem>
            <NavItem to="/leaderboard">
              <span className="lg:hidden">Ranks</span>
              <span className="hidden lg:inline">Leaderboard</span>
            </NavItem>
          </div>
          <div className="ml-1 shrink-0 sm:ml-3">
            <AuthMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t hairline">
      <div className="container-page flex flex-col items-center justify-between gap-5 py-10 text-stone-500 sm:flex-row">
        <Link to="/" className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-[0.12em] text-stone-300 uppercase">
          <Logo />
          Game Hub
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 label-mono">
          {games.map((g) => (
            <Link key={g.id} to={g.path} className="transition-colors hover:text-stone-200">
              {g.title}
            </Link>
          ))}
          <Link to="/album" className="transition-colors hover:text-stone-200">
            Album
          </Link>
          <Link to="/leaderboard" className="transition-colors hover:text-stone-200">
            Leaderboard
          </Link>
        </nav>
        <p className="font-serif text-sm">A new puzzle every day.</p>
      </div>
    </footer>
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <span className="h-8 w-8 animate-spin rounded-full border border-white/15 border-t-lamp-400" />
    </div>
  );
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);
  useAvatarSync();
  const { pathname } = useLocation();
  // Games get the full viewport (no header or footer); landing pages (the hub's and each game's) lay out their
  // own sections; other pages sit in a centered column.
  const game = games.some((g) => pathname === playPath(g));
  const landing = pathname === "/" || games.some((g) => pathname === g.path);
  // Paper everywhere, game screens included; night only for pages that are one night scene.
  const scheme = NIGHT_PAGES.has(pathname) ? "night" : "paper";
  useEffect(() => {
    const { classList } = document.body;
    classList.toggle("theme-night", scheme === "night");
    classList.toggle("theme-paper", scheme === "paper");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scheme === "night" ? "#0c1f1e" : "#f3ead9");
  }, [scheme]);

  return (
    <div className={`theme-${scheme} relative flex min-h-dvh flex-col text-stone-100`}>
      {/* Games take the whole screen; each has its own way back. */}
      {!game && <Header />}
      <main
        key={game ? "game" : pathname}
        className={game || landing ? "flex-1" : "mx-auto w-full max-w-5xl flex-1 animate-rise px-4 py-8 sm:px-6 sm:py-12"}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HubHome />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/album" element={<Album />} />
            <Route path="/avatar" element={<AvatarPage />} />
            {games.map((g) => (
              <Route key={g.id} path={g.path} element={<g.Landing />} />
            ))}
            {games.map((g) => (
              <Route key={`${g.id}-play`} path={playPath(g)} element={<g.Component />} />
            ))}
            {AnglePicker && <Route path="/dev/angles" element={<AnglePicker />} />}
          </Routes>
        </Suspense>
      </main>
      {!game && <Footer />}
    </div>
  );
}
