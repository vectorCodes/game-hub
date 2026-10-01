/** A lamp and the shadow it casts. */
export function Logo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_0_24px_-4px_rgba(217,70,239,0.8)]">
      <span className="h-3.5 w-3.5 translate-x-0.5 translate-y-0.5 rounded-full bg-stone-950/85 ring-2 ring-cyan-300/70" />
    </span>
  );
}
