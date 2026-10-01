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

/** Pill toggle with a sliding highlight. */
export function Segmented<T extends string>({ options, value, onChange, label, className = "" }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative grid rounded-full bg-white/5 p-1 text-sm ring-1 ring-white/10 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_18px_-4px_rgba(217,70,239,0.8)] transition-transform duration-300 ease-out"
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
          className={`relative z-10 rounded-full px-4 py-1.5 font-medium whitespace-nowrap transition-colors ${
            o.value === value ? "text-white" : "text-stone-400 hover:text-stone-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
