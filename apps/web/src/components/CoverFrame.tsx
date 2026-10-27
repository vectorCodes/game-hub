import type { ReactNode } from "react";

/**
 * The frame every game's cover sits in, so the lineup reads as one set of key art: a lit
 * scene edge to edge, film grain over the flat fills, and a vignette pulling the eye in.
 * The art is an SVG drawn on a 400 × 260 stage and cropped to fill (keep the subject inside
 * x 40–360, y 20–240 so both the 16:9 and 4:3 tiles hold it). Fixed colours, not the scheme
 * tokens, so a cover looks the same on a paper page and on a night one.
 */
export function CoverFrame({
  label,
  caption,
  children,
  className = "",
}: {
  /** What the picture shows, for screen readers. */
  label: string;
  /** A short note pinned to the corner (today's theme). */
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={`relative isolate h-full min-h-64 overflow-hidden rounded-xs bg-[#0b0910] md:min-h-80 ${className}`}>
      <div className="absolute inset-0 *:h-full *:w-full">{children}</div>
      <div aria-hidden className="cover-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.55)]" />
      {caption && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-[#f6ead6] ring-1 ring-white/10 backdrop-blur-sm">
          {caption}
        </span>
      )}
    </div>
  );
}
