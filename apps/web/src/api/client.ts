import { supabase } from "../lib/supabase";

/** Empty in dev (Vite proxies /api); the API's origin in production. */
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["content-type"] = "application/json";
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    // Fastify rejects an empty JSON body, so body-less POSTs send {}.
    body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    // No JSON body on a 5xx means the dev proxy couldn't reach the API at all.
    const code = data?.error ?? (res.status >= 500 ? "api_unreachable" : "request_failed");
    throw new ApiError(res.status, code);
  }
  return res.json();
}
