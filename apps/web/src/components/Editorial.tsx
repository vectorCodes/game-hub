// Building blocks for the printed-sheet pages (profile, album): a numbered chapter header and
// a strip of stats divided by hairlines.
import type { ReactNode } from "react";
import { Link } from "react-router";

/** "01 — Shadow Guess", a short note, and a link out on the right. Wraps on phones. */
export function ChapterHeader({ number, title, note, link }: { number: string; title: string; note?: ReactNode; link?: { to: string; label: string } }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b hairline pb-3">
      <div className="min-w-0">
        <div className="label-mono text-ember-400">{number}</div>
        <h2 className="mt-1 font-display text-2xl leading-none font-light uppercase sm:text-3xl">{title}</h2>
        {note && <p className="mt-2 font-serif text-sm text-stone-400">{note}</p>}
      </div>
      {link && (
        <Link to={link.to} className="label-mono text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors hover:text-stone-50">
          {link.label} →
        </Link>
      )}
    </header>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
  /** Set in sun red: the number worth noticing. */
  accent?: boolean;
}

/** Big light numerals over mono captions; two across on phones, four on wider screens. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 border-b hairline sm:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`px-4 py-5 sm:px-5 ${i % 2 === 1 ? "border-l hairline" : ""} ${i >= 2 ? "border-t hairline sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}
        >
          <dt className="label-mono text-stone-500">{s.label}</dt>
          <dd className={`mt-2 font-display text-4xl leading-none font-light tabular-nums sm:text-5xl ${s.accent ? "text-ember-500" : ""}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
