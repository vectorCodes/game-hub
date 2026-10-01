import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Null when Supabase isn't configured: the site still works, just without sign-in.
 * PKCE flow: Google sign-in returns a one-time `?code=` that the client exchanges (and
 * removes from the URL) instead of putting the access token in the address bar.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { flowType: "pkce" } }) : null;
