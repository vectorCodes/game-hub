/** A seal: a gold square with a sun, and the ink shadow it casts. */
export function Logo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center rounded-sm bg-gold">
      <span className="h-3.5 w-3.5 rounded-full bg-sun" />
      <span className="absolute h-3.5 w-3.5 translate-x-1 translate-y-1 rounded-full bg-ink mix-blend-multiply" />
    </span>
  );
}
