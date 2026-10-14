import type { ReactNode } from "react";

/**
 * The frame every game's cover sits in, so the lineup reads as one printed set: a paper
 * panel with a fine grid, a numbered mono header, and a caption rule at the foot. The art
 * inside is a flat vector drawing in ink, sun, gold and jade. Fixed colours (not the scheme
 * tokens), so a cover looks the same on a paper page and on a night one.
 */
export function CoverFrame({
  number,
  title,
  meta,
  caption,
  children,
  className = "",
}: {
  number: string;
  title: string;
  meta: ReactNode;
  caption: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative isolate h-full min-h-64 overflow-hidden rounded-xs bg-paper-soft text-ink ring-1 ring-ink/15 md:min-h-80 ${className}`}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(42,34,22,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(42,34,22,0.04)_1px,transparent_1px)] bg-[size:28px_28px]"
      />
      <div className="absolute inset-0 px-4 pt-11 pb-10 sm:px-6">{children}</div>
      <div className="absolute inset-x-4 top-3.5 flex items-center justify-between gap-3 font-mono text-[10px] font-medium tracking-[0.14em] uppercase sm:inset-x-6">
        <span className="truncate">
          <span className="text-sun">{number}</span> — {title}
        </span>
        <span className="shrink-0 text-ink/60">{meta}</span>
      </div>
      <div className="absolute inset-x-4 bottom-3 flex items-center justify-between gap-3 border-t border-ink/15 pt-2 font-mono text-[10px] tracking-[0.14em] text-ink/60 uppercase sm:inset-x-6">
        <span className="truncate">{caption}</span>
        <span className="shrink-0">3D</span>
      </div>
    </div>
  );
}
