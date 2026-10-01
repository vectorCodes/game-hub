import { useId } from "react";

/**
 * Lumi, the site's mascot: a desk lamp that bobs its head, blinks, and shines a beam.
 * Pure SVG + CSS keyframes (index.css), so it costs nothing to load and stops under
 * prefers-reduced-motion.
 */
export function Lumi({ className = "" }: { className?: string }) {
  // Unique per instance: gradients inside a display:none copy don't resolve for others.
  const id = useId();
  const beam = `${id}-beam`;
  const shade = `${id}-shade`;
  const bulb = `${id}-bulb`;
  return (
    <svg viewBox="0 0 170 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={beam} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f8cf72" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={shade} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8cf72" />
          <stop offset="1" stopColor="#e9a03a" />
        </linearGradient>
        <radialGradient id={bulb}>
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.5" stopColor="#fff6dc" />
          <stop offset="1" stopColor="#f8cf72" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Base and lower arm stay put. */}
      <ellipse cx="62" cy="150" rx="26" ry="5" fill="#263029" />
      <path d="M62 148 L52 104" stroke="#c2c3b1" strokeWidth="7" strokeLinecap="round" />
      <circle cx="52" cy="102" r="6" fill="#ddd8c8" />

      {/* Upper arm, head and beam turn together around the elbow. */}
      <g className="animate-lamp-bob" style={{ transformBox: "view-box", transformOrigin: "52px 102px" }}>
        <path
          className="animate-beam"
          d="M103 88 L130 70 L170 150 L92 158 Z"
          fill={`url(#${beam})`}
          style={{ mixBlendMode: "screen" }}
        />
        <path d="M52 102 L84 60" stroke="#c2c3b1" strokeWidth="7" strokeLinecap="round" />
        <circle cx="120" cy="84" r="16" fill={`url(#${bulb})`} className="animate-beam" />
        <path d="M78 56 L94 46 L132 70 L104 90 Z" fill={`url(#${shade})`} strokeLinejoin="round" />
        {/* Eyes, on the shade. */}
        <g className="animate-blink" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <ellipse cx="100" cy="68" rx="2.6" ry="3.6" fill="#16201b" />
          <ellipse cx="111" cy="62" rx="2.6" ry="3.6" fill="#16201b" />
        </g>
        <path d="M101 76 Q106 79 111 73" stroke="#16201b" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
