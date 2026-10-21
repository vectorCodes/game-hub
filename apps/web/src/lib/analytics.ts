// Product analytics (PostHog). Off when VITE_POSTHOG_PROJECT_TOKEN is empty.
// Events go through /ingest on our own origin (a Vercel rewrite in production, the Vite
// proxy in dev) so ad blockers don't drop them.
import posthog from "posthog-js";

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    // A pageview on every react-router navigation, not just the first load.
    capture_pageview: "history_change",
    // Guests stay anonymous events; only signed-in players get a person profile.
    person_profiles: "identified_only",
  });
}

export type GameId = "shadow-guess" | "sky-climb" | "pair-pop" | "prop-hunt";

/** A named event, e.g. track("game_finished", { game: "sky-climb", floor: 12 }). */
export function track(event: string, props?: Record<string, unknown>) {
  if (token) posthog.capture(event, props);
}

/** Ties this browser's events (guest ones included) to the account. */
export function identify(id: string, props: Record<string, unknown>) {
  if (token) posthog.identify(id, props);
}

/** After sign-out: the next events start a fresh anonymous visitor. */
export function resetIdentity() {
  if (token) posthog.reset();
}
