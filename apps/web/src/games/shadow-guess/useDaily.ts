import { useEffect, useState } from "react";
import type { DailyInfo } from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { savedDailySessionId } from "./store";

/** The Shadow Guess landing page; the game itself is at SHADOW_GUESS_PATH. */
export const SHADOW_GUESS_HOME = "/games/shadow-guess";
export const SHADOW_GUESS_PATH = `${SHADOW_GUESS_HOME}/play`;

// One request per player per page view, shared by every component that asks.
const cache = new Map<string, Promise<DailyInfo>>();

/** Today's puzzle and the player's status on it; null while loading or if the API is down. */
export function useDaily(): DailyInfo | null {
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  const [info, setInfo] = useState<DailyInfo | null>(null);

  useEffect(() => {
    if (!synced) return;
    const guest = userId ? null : savedDailySessionId();
    const path = `/api/shadow-guess/daily${guest ? `?sessionId=${guest}` : ""}`;
    const key = `${userId ?? "guest"}:${path}`;
    if (!cache.has(key)) cache.set(key, api<DailyInfo>(path));
    let live = true;
    cache.get(key)!.then(
      (i) => live && setInfo(i),
      () => {
        cache.delete(key);
        if (live) setInfo(null);
      },
    );
    return () => {
      live = false;
    };
  }, [synced, userId]);

  return info;
}

/** Re-renders every 30 s, for countdowns. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function dailyDone(info: DailyInfo | null) {
  return info?.status === "won" || info?.status === "lost";
}

export function dailyCta(info: DailyInfo | null): string {
  if (dailyDone(info)) return "See today's result";
  return info?.status === "playing" ? "Continue today's daily" : "Play today's daily";
}
