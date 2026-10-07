// Tiny looping demos for "How it works": pull back to aim, bank off a wall, sink it.
import type { ReactNode } from "react";
import { MOTION } from "./Sky";

const DUR = "3.6s";
const loop = { dur: DUR, repeatCount: "indefinite" } as const;

/** A patch of green with rails, the stage every demo plays on. */
function Green({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" aria-hidden>
      <rect x="6" y="6" width="228" height="138" rx="22" fill="#e8875a" />
      <rect x="14" y="14" width="212" height="122" rx="16" fill="#5fcf86" />
      <rect x="14" y="14" width="212" height="122" rx="16" fill="url(#pi-demo-sheen)" />
      <defs>
        <linearGradient id="pi-demo-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export function PullDemo() {
  return (
    <Green>
      <ellipse cx="200" cy="44" rx="9" ry="5" fill="#14231b" />
      {MOTION ? (
        <>
          {/* The aim line grows with the pull. */}
          <line x1="110" y1="88" x2="200" y2="44" stroke="#fff" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.9;0.9;0;0" keyTimes="0;0.5;0.55;0.58;1" {...loop} />
          </line>
          {/* The elastic from the ball to the finger. */}
          <line x1="110" y1="88" stroke="#fbe3a8" strokeWidth="3" strokeLinecap="round">
            <animate attributeName="x2" values="110;60;60;110;110" keyTimes="0;0.5;0.55;0.58;1" {...loop} />
            <animate attributeName="y2" values="88;112;112;88;88" keyTimes="0;0.5;0.55;0.58;1" {...loop} />
            <animate attributeName="opacity" values="1;1;1;0;0" keyTimes="0;0.5;0.55;0.58;1" {...loop} />
          </line>
          <circle r="11" fill="#fff" fillOpacity="0.25" stroke="#fff" strokeOpacity="0.8" strokeWidth="2">
            <animate attributeName="cx" values="110;60;60;60" keyTimes="0;0.5;0.58;1" {...loop} />
            <animate attributeName="cy" values="88;112;112;112" keyTimes="0;0.5;0.58;1" {...loop} />
            <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.1;0.55;0.6;1" {...loop} />
          </circle>
          <circle r="7" fill="#fff">
            <animate attributeName="cx" values="110;110;200;200" keyTimes="0;0.58;0.85;1" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.3 1;0 0 1 1" {...loop} />
            <animate attributeName="cy" values="88;88;44;44" keyTimes="0;0.58;0.85;1" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.3 1;0 0 1 1" {...loop} />
            <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.84;0.88;1" {...loop} />
          </circle>
        </>
      ) : (
        <circle cx="110" cy="88" r="7" fill="#fff" />
      )}
    </Green>
  );
}

const BANK = "M44 112 L 128 22 L 202 106";

export function BankDemo() {
  return (
    <Green>
      {/* A wall in the middle, so the only way in is off the top rail. */}
      <rect x="112" y="70" width="12" height="66" rx="3" fill="#e8875a" />
      <ellipse cx="202" cy="106" rx="9" ry="5" fill="#14231b" />
      <polyline points="44,112 128,22 160,56" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
      {MOTION ? (
        <>
          {/* The rail lights up where it's hit. */}
          <rect x="110" y="8" width="36" height="6" rx="3" fill="#fbe3a8" opacity="0">
            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.38;0.42;0.55;1" {...loop} />
          </rect>
          <circle r="7" fill="#fff">
            <animateMotion path={BANK} keyPoints="0;0;1;1" keyTimes="0;0.15;0.8;1" calcMode="linear" {...loop} />
            <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.8;0.84;1" {...loop} />
          </circle>
        </>
      ) : (
        <circle cx="44" cy="112" r="7" fill="#fff" />
      )}
    </Green>
  );
}

export function SinkDemo() {
  return (
    <Green>
      <ellipse cx="170" cy="82" rx="11" ry="6" fill="#14231b" />
      <line x1="170" y1="82" x2="170" y2="30" stroke="#f6f3ea" strokeWidth="2.5" />
      <path d="M171 30 L 196 38 L 171 46 Z" fill="#ef5a4f" className="animate-flag" style={{ transformBox: "fill-box", transformOrigin: "left" }} />
      {MOTION ? (
        <>
          <circle cy="82" fill="#fff">
            <animate attributeName="cx" values="40;40;170;170" keyTimes="0;0.1;0.6;1" calcMode="spline" keySplines="0 0 1 1;0.15 0.6 0.4 1;0 0 1 1" {...loop} />
            <animate attributeName="r" values="7;7;7;3;0;0" keyTimes="0;0.1;0.6;0.64;0.66;1" {...loop} />
          </circle>
          <circle cx="170" cy="82" fill="none" stroke="#fbe3a8" strokeWidth="2.5">
            <animate attributeName="r" values="6;6;30;30" keyTimes="0;0.64;0.82;1" {...loop} />
            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.64;0.66;0.82;1" {...loop} />
          </circle>
          <g opacity="0">
            <rect x="64" y="104" width="76" height="24" rx="12" fill="#14231b" fillOpacity="0.75" />
            <text x="102" y="121" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="700" fontSize="14" fill="#fbe3a8">
              Birdie!
            </text>
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.66;0.7;0.92;1" {...loop} />
          </g>
        </>
      ) : (
        <circle cx="40" cy="82" r="7" fill="#fff" />
      )}
    </Green>
  );
}
