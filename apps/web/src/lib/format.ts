/** 83 → "1m 23s", 3725 → "1h 2m". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Time until `iso`, coarse: "5h 12m", "3m", "under a minute". */
export function formatCountdown(iso: string, now = Date.now()): string {
  const mins = Math.floor((Date.parse(iso) - now) / 60_000);
  if (mins < 1) return "under a minute";
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}
