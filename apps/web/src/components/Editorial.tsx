// Building blocks for the profile and the album: a numbered chapter header and a row of stat
// tiles. Both take the accent of the nearest [data-game].
import type { ReactNode } from "react";
import { Link } from "react-router";

/** "01 — Shadow Guess", a short note, and a link out on the right. Wraps on phones. */
export function ChapterHeader({ number, title, note, link }: { number: string; title: string; note?: ReactNode; link?: { to: string; label: string } }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b hairline pb-3">
      <div className="min-w-0">
        <div className="label-mono text-accent-text">{number}</div>
        <h2 className="mt-2 font-display text-3xl leading-none font-bold tracking-tight sm:text-4xl">{title}</h2>
        {note && <p className="mt-2 text-sm text-stone-400">{note}</p>}
      </div>
      {link && (
        <Link to={link.to} className="group font-display font-bold text-accent-text">
          {link.label} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </header>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
  /** Set in the accent: the number worth noticing. */
  accent?: boolean;
}

/** Big heavy numerals over mono captions, one tile each; two across on phones, four on wider screens. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`surface px-4 py-5 sm:px-5 ${s.accent ? "shadow-[inset_0_0_0_1.5px_var(--accent)]" : ""}`}>
          <dt className="label-mono text-stone-500">{s.label}</dt>
          <dd className={`mt-2 font-display text-4xl leading-none font-extrabold tracking-tight tabular-nums sm:text-5xl ${s.accent ? "text-accent-text" : ""}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
