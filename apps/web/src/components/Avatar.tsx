interface Props {
  src: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-16 w-16 text-xl" };

export function Avatar({ src, name, size = "sm", className = "" }: Props) {
  const base = `${SIZES[size]} shrink-0 rounded-full ring-2 ring-white/10 ${className}`;
  return src ? (
    <img src={src} alt="" referrerPolicy="no-referrer" className={`${base} object-cover`} />
  ) : (
    <span className={`${base} grid place-items-center bg-gradient-to-br from-stone-600 to-stone-800 font-semibold`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
