interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** Tab toggle: a hairline frame with a sliding gold block under the current tab. */
export function Segmented<T extends string>({ options, value, onChange, label, className = "" }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative grid rounded-xs p-1 label-mono ring-1 ring-white/15 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-xs bg-gold transition-transform duration-300 ease-mirai"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => o.value !== value && onChange(o.value)}
          className={`relative z-10 min-h-9 px-3 py-1.5 whitespace-nowrap transition-colors sm:px-4 ${
            o.value === value ? "text-ink" : "text-stone-400 hover:text-stone-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
