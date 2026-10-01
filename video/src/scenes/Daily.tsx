import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BAR, BEAT, hit, snap } from "../beats";
import { Slam } from "../stage/Type";
import { accentGradient, bodyFont, colors, displayFont } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const card = {
  borderRadius: 32,
  background: "rgba(23,32,25,0.75)",
  border: `1px solid ${colors.hairline}`,
  boxShadow: "0 40px 120px -40px rgba(0,0,0,0.85)",
} as const;

/** The site's streak flame, flickering with the frame. */
function Flame({ frame }: { frame: number }) {
  const f = Math.sin(frame * 0.7) * 0.04;
  return (
    <svg viewBox="0 0 64 64" width={150} height={150} style={{ scale: `${1 - f} ${1 + f}`, transformOrigin: "50% 90%" }}>
      <defs>
        <linearGradient id="daily-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ec7a5f" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path d="M32 8 C40 20 50 26 48 40 C46 50 39 56 32 56 C25 56 18 50 16 41 C14 31 22 26 24 16 C28 22 30 24 32 8 Z" fill="url(#daily-flame)" />
      <path d="M32 30 C36 36 40 40 38 46 C37 50 34 52 32 52 C29 52 26 50 26 46 C26 41 30 38 32 30 Z" fill="#fde68a" />
    </svg>
  );
}

const ROWS = [
  { rank: 1, name: "You", score: 100, me: true },
  { rank: 2, name: "Maya", score: 85, me: false },
  { rank: 3, name: "Leo", score: 70, me: false },
];

/** 24–28 s: a new puzzle every day, a streak to keep, a board to climb. */
export const Daily = () => {
  const frame = useCurrentFrame();
  // Bar 1: the puzzle number rolls; bar 2: streak and leaderboard.
  const day = Math.round(interpolate(frame, [4, 50], [1, 365], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const streak = Math.round(interpolate(frame, [BAR + 4, BAR + 44], [1, 30], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const second = frame >= BAR;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night, fontFamily: bodyFont, color: colors.text }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 50% 60% at 70% 45%, rgba(244,185,78,0.12), transparent 70%)" }} />

      {!second && (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 160px" }}>
          <div>
            <Slam at={0} style={{ fontFamily: displayFont, fontSize: 120, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.045em" }}>
              A new puzzle
            </Slam>
            <Slam at={BEAT} style={{ fontFamily: displayFont, fontSize: 120, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.045em", color: colors.muted }}>
              every day.
            </Slam>
            <Slam at={BEAT * 2} from={1.1} style={{ marginTop: 30, fontSize: 40, color: colors.muted }}>
              Same shadow for everyone.
            </Slam>
          </div>
          <div style={{ ...card, width: 420, padding: "44px 48px", scale: String(0.9 + 0.1 * snap(frame, 0, 12)), opacity: snap(frame, 0, 10) }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.2em", color: colors.muted }}>DAILY</div>
            <div style={{ marginTop: 6, fontFamily: displayFont, fontSize: 150, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              #{day}
            </div>
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12, fontSize: 28, color: colors.muted }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: colors.moss, boxShadow: `0 0 18px ${colors.moss}` }} />
              Live now
            </div>
          </div>
        </AbsoluteFill>
      )}

      {second && (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 60 }}>
          <div style={{ ...card, width: 520, height: 520, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: snap(frame, BAR, 10), scale: String(0.9 + 0.1 * snap(frame, BAR, 12)) }}>
            <Flame frame={frame} />
            <div style={{ marginTop: 10, fontFamily: displayFont, fontSize: 170, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>{streak}</div>
            <div style={{ marginTop: 8, fontSize: 32, color: colors.muted }}>day streak</div>
          </div>
          <div style={{ ...card, width: 640, padding: "40px 44px", opacity: snap(frame, BAR + BEAT, 10), translate: `${(1 - snap(frame, BAR + BEAT, 12)) * 60}px 0px` }}>
            <div style={{ fontFamily: displayFont, fontSize: 54, fontWeight: 700, letterSpacing: "-0.03em" }}>Leaderboard</div>
            <div style={{ marginTop: 6, fontSize: 26, color: colors.muted }}>Today · fewer angles, higher rank</div>
            <div style={{ marginTop: 28 }}>
              {ROWS.map((r, i) => {
                const at = BAR + BEAT * 2 + i * 5;
                const t = snap(frame, at, 10);
                return (
                  <div
                    key={r.rank}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 22,
                      marginTop: 14,
                      padding: "18px 22px",
                      borderRadius: 20,
                      background: r.me ? "rgba(244,185,78,0.16)" : "rgba(255,255,255,0.04)",
                      border: r.me ? "1px solid rgba(248,207,114,0.45)" : `1px solid ${colors.hairline}`,
                      opacity: t,
                      translate: `${(1 - t) * 50}px 0px`,
                      fontSize: 34,
                    }}
                  >
                    <span style={{ width: 40, fontFamily: displayFont, fontWeight: 700, color: r.rank === 1 ? "#fbbf24" : colors.muted }}>{r.rank}</span>
                    <span style={{ width: 52, height: 52, borderRadius: 99, background: r.me ? accentGradient : "rgba(255,255,255,0.12)" }} />
                    <span style={{ flex: 1, fontWeight: r.me ? 600 : 400 }}>{r.name}</span>
                    <span style={{ fontFamily: displayFont, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.me ? colors.moss : colors.text, scale: String(1 + (r.me ? hit(frame, at + 10, 8) * 0.25 : 0)) }}>
                      {r.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
