// Prop Hunt is played with a keyboard and mouse: on phones and tablets the house stays shut.
import { Link } from "react-router";

/** The note in place of the play buttons on the landing page. */
export function DesktopOnlyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-sm border hairline px-4 py-3 font-serif text-sm text-stone-300 ${className}`}>
      <span aria-hidden className="text-lg">🖥️</span>
      Prop Hunt is played on a computer, with a keyboard and mouse. Open it on your Mac or PC to play.
    </p>
  );
}

/** The play page on a phone or tablet. */
export function DesktopOnlyScreen() {
  return (
    <div className="container-page grid min-h-[calc(100svh-4rem)] place-items-center py-16 text-center">
      <div className="max-w-md">
        <div aria-hidden className="text-5xl">🖥️</div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Desktop only</h1>
        <p className="mt-3 font-serif text-stone-300">
          Prop Hunt needs a keyboard and mouse, so it can&rsquo;t be played on a phone or tablet. Open this page on your Mac or PC to
          play.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/games/prop-hunt" className="btn btn-primary">
            About Prop Hunt
          </Link>
          <Link to="/" className="btn btn-secondary">
            Other games
          </Link>
        </div>
      </div>
    </div>
  );
}
