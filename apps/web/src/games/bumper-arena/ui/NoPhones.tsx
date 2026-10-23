// Bumper Arena is played on computers and tablets: a phone's screen is too small to follow a
// whole arena of rings and still have room for the thumbs.
import { Link } from "react-router";

/** A touch screen whose short side is phone-sized (iPads start at 744 px). */
export function isPhone(): boolean {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch && Math.min(window.screen.width, window.screen.height) < 600;
}

/** The play page on a phone. */
export function NoPhonesScreen() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[var(--color-paper)] px-6 py-16 text-center">
      <div className="max-w-md">
        <div aria-hidden className="text-5xl">💻</div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Computer or tablet</h1>
        <p className="mt-3 font-serif text-stone-300">
          Bumper Arena needs a bigger screen than a phone&rsquo;s. Open this page on your computer or a tablet to play.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/" className="btn btn-primary">
            Other games
          </Link>
        </div>
      </div>
    </div>
  );
}
