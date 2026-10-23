// Prototype-only: sliders over the ring tuning, applied live to the round in progress, and
// a button that copies the values (to paste back into BUMPER_TUNING once they feel right).
import { useState } from "react";
import { BUMPER_TUNING, type BumperTuning } from "@shadow/shared";
import { tuning } from "../store";

const SLIDERS: { key: keyof BumperTuning; label: string; min: number; max: number; step: number }[] = [
  { key: "maxSpeed", label: "Top speed", min: 2, max: 10, step: 0.1 },
  { key: "accel", label: "Acceleration", min: 4, max: 40, step: 0.5 },
  { key: "drag", label: "Drag", min: 0, max: 3, step: 0.05 },
  { key: "brakeDrag", label: "Brake drag", min: 0, max: 8, step: 0.1 },
  { key: "overspeedDecel", label: "Slide-out decel", min: 2, max: 40, step: 0.5 },
  { key: "dashSpeed", label: "Dash speed", min: 4, max: 20, step: 0.1 },
  { key: "dashSeconds", label: "Dash time", min: 0.05, max: 0.6, step: 0.01 },
  { key: "dashCooldown", label: "Dash cooldown", min: 0.2, max: 5, step: 0.1 },
  { key: "braceMass", label: "Brace mass", min: 1, max: 5, step: 0.1 },
  { key: "braceSpeed", label: "Brace speed", min: 0, max: 1, step: 0.05 },
  { key: "restitution", label: "Bounciness", min: 0, max: 1, step: 0.05 },
  { key: "knockBase", label: "Knockback", min: 0, max: 10, step: 0.1 },
  { key: "knockFloor", label: "Knock at 0%", min: 0, max: 1, step: 0.05 },
  { key: "dashKnock", label: "Dash knock ×", min: 1, max: 3, step: 0.05 },
  { key: "wobbleDash", label: "Wobble / dash hit", min: 0, max: 50, step: 1 },
  { key: "wobbleBump", label: "Wobble / bump", min: 0, max: 30, step: 1 },
  { key: "wobbleDrain", label: "Wobble drain /s", min: 0, max: 15, step: 0.5 },
  { key: "radius", label: "Ring radius", min: 0.3, max: 1.2, step: 0.05 },
];

export function TuningPanel() {
  const [, redraw] = useState(0);
  const [copied, setCopied] = useState(false);
  const set = (key: keyof BumperTuning, value: number) => {
    tuning[key] = value;
    redraw((n) => n + 1);
  };

  return (
    <div className="glass absolute top-16 right-4 bottom-4 w-72 overflow-y-auto p-4 text-xs text-stone-100">
      <div className="flex items-center justify-between">
        <span className="label-mono text-stone-400">Tuning (live)</span>
        <button
          className="label-mono text-stone-400 hover:text-stone-100"
          onClick={() => {
            Object.assign(tuning, BUMPER_TUNING);
            redraw((n) => n + 1);
          }}
        >
          Reset
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {SLIDERS.map((s) => (
          <label key={s.key} className="flex flex-col gap-1">
            <span className="flex justify-between">
              <span>{s.label}</span>
              <span className={`font-mono tabular-nums ${tuning[s.key] !== BUMPER_TUNING[s.key] ? "text-lamp-500" : "text-stone-400"}`}>{tuning[s.key]}</span>
            </span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={tuning[s.key]} onChange={(e) => set(s.key, Number(e.target.value))} className="accent-[var(--color-gold)]" />
          </label>
        ))}
      </div>
      <button
        className="btn-primary mt-4 h-10 w-full rounded-xs font-mono text-[11px] font-semibold tracking-[0.12em] uppercase"
        onClick={() => {
          void navigator.clipboard?.writeText(JSON.stringify(tuning, null, 2)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy values"}
      </button>
    </div>
  );
}
