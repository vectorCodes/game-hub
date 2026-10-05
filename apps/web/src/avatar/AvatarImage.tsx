import { useEffect, useState } from "react";
import type { AvatarConfig } from "@shadow/shared";
import { avatarPortrait } from "./portrait";

const SIZES = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-16 w-16", xl: "h-28 w-28" };

/** A player's avatar portrait in a circle; a soft placeholder while it's drawn. */
export function AvatarImage({
  config,
  size = "md",
  className = "",
}: {
  config: AvatarConfig;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    avatarPortrait(config).then(
      (url) => live && setSrc(url),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [config]);
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-stone-600 to-stone-800 ring-1 ring-white/15 ${SIZES[size]} ${className}`}>
      {src ? <img src={src} alt="" className="h-full w-full scale-125 object-cover" /> : <span className="absolute inset-0 animate-pulse bg-white/5" />}
    </span>
  );
}
