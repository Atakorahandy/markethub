"use client";

/** Tiny browser fetch wrapper around the MarketHub API envelope. Cookies carry
 *  the session, so no token handling here. */
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string; details?: unknown };
    err.code = json?.error?.code;
    err.details = json?.error?.details;
    throw err;
  }
  return (json.data ?? json) as T;
}
