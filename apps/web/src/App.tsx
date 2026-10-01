import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import { AuthMenu } from "./auth/AuthMenu";
import { useAuth } from "./auth/store";
import { Logo } from "./components/Logo";
import { games } from "./games/registry";

// Lazy: the album draws 3D models, so it brings three.js with it.
const Album = lazy(() => import("./games/shadow-guess/album/AlbumPage"));

// Compiled out of production builds.
const AnglePicker = import.meta.env.DEV ? lazy(() => import("./pages/dev/AnglePicker")) : null;

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-full px-3.5 py-2 transition-colors ${
          isActive ? "bg-white/10 text-white" : "text-stone-400 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-stone-950/75 backdrop-blur-xl">
      <nav className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">GameHub</span>
        </Link>
        <div className="flex items-center gap-0.5 text-sm sm:gap-1">
          {games.map((g) => (
            <NavItem key={g.id} to={g.path}>
              <span className="sm:hidden">Play</span>
              <span className="hidden sm:inline">{g.title}</span>
            </NavItem>
          ))}
          <NavItem to="/album">Album</NavItem>
          <NavItem to="/leaderboard">
            <span className="sm:hidden">Ranks</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </NavItem>
          <div className="ml-1.5 sm:ml-3">
            <AuthMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-stone-950/85 backdrop-blur-xl">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 text-sm text-stone-500 sm:flex-row">
        <Link to="/" className="flex items-center gap-2.5 font-display font-semibold text-stone-300">
          <Logo />
          GameHub
        </Link>
        <nav className="flex items-center gap-6">
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
        <p>A new puzzle every day.</p>
      </div>
    </footer>
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-lamp-400" />
    </div>
  );
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);
  const { pathname } = useLocation();
  // Games get the full viewport; the landing page lays out its own sections; other
  // pages sit in a centered column.
  const game = pathname.startsWith("/games/");
  const landing = pathname === "/";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_45%_55%_at_15%_-5%,rgba(244,185,78,0.16),transparent),radial-gradient(ellipse_40%_45%_at_90%_0%,rgba(109,173,75,0.14),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-[size:56px_56px]"
      />
      <Header />
      <main
        key={game ? "game" : pathname}
        className={game || landing ? "flex-1" : "mx-auto w-full max-w-5xl flex-1 animate-rise px-4 py-8 sm:px-6 sm:py-12"}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/album" element={<Album />} />
            {games.map((g) => (
              <Route key={g.id} path={g.path} element={<g.Component />} />
            ))}
            {AnglePicker && <Route path="/dev/angles" element={<AnglePicker />} />}
          </Routes>
        </Suspense>
      </main>
      {!game && <Footer />}
    </div>
  );
}
