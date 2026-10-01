interface Props {
  step: number;
  maxSteps: number;
  thumbnails: (string | undefined)[];
  /** Step shown in the scene, or null for the current one. */
  viewing: number | null;
  onView: (step: number | null) => void;
  /** Past rounds can't be revisited in the scene (the object is revealed). */
  interactive?: boolean;
}

/** One tile per light angle: past shadows can be revisited, future ones stay dark. */
export function ShadowHistory({ step, maxSteps, thumbnails, viewing, onView, interactive = true }: Props) {
  const shown = viewing ?? step;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs font-medium tracking-wide text-stone-400 uppercase">
        <span>Light angles</span>
        {viewing !== null ? (
          <button onClick={() => onView(null)} className="normal-case tracking-normal text-moss-300 hover:underline">
            Back to current →
          </button>
        ) : (
          <span className="tabular-nums normal-case tracking-normal">
            <span className="text-stone-100">{step + 1}</span> / {maxSteps}
          </span>
        )}
      </div>
      <ol className="grid grid-cols-6 gap-1.5 md:grid-cols-3 md:gap-2">
        {Array.from({ length: maxSteps }, (_, i) => {
          const revealed = i <= step;
          const active = interactive && i === shown;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!revealed || !interactive}
                onClick={() => onView(i === step ? null : i)}
                aria-label={revealed ? `Show light angle ${i + 1}` : `Angle ${i + 1} not revealed yet`}
                aria-pressed={active}
                className={`group relative block aspect-[4/3] w-full overflow-hidden rounded-lg transition duration-200 md:rounded-xl ${
                  revealed
                    ? `bg-wall ${active ? "ring-2 ring-lamp-400 ring-offset-2 ring-offset-stone-950 shadow-[0_0_20px_-4px_rgba(233,160,58,0.8)]" : "ring-1 ring-white/10 hover:ring-white/30"} ${interactive ? "hover:-translate-y-0.5" : ""}`
                    : "bg-white/[0.03] ring-1 ring-white/5 ring-inset"
                }`}
              >
                {revealed && thumbnails[i] ? (
                  <img src={thumbnails[i]} alt="" className="h-full w-full animate-pop object-cover" />
                ) : (
                  <span
                    className={`grid h-full place-items-center text-[11px] font-medium tabular-nums ${revealed ? "text-ink/40" : "text-stone-600"}`}
                  >
                    {i + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
