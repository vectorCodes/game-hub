/** A lamp and the shadow it casts. */
export function Logo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-lamp-200 via-lamp-400 to-lamp-600 shadow-[0_0_24px_-6px_rgba(244,185,78,0.7)]">
      <span className="h-3.5 w-3.5 translate-x-0.5 translate-y-0.5 rounded-full bg-ink ring-2 ring-stone-50/60" />
    </span>
  );
}
