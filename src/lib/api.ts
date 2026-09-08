import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { env } from "./env";

/** Consistent API envelope. */
export type ApiOk<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: number | ResponseInit, meta?: Record<string, unknown>) {
  const status = typeof init === "number" ? init : (init as ResponseInit)?.status ?? 200;
  return NextResponse.json<ApiOk<T>>({ ok: true, data, ...(meta ? { meta } : {}) }, { status });
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (m = "Please sign in to continue.") => new ApiError("unauthorized", m, 401),
  forbidden: (m = "You do not have permission to do that.") => new ApiError("forbidden", m, 403),
  notFound: (m = "That item could not be found.") => new ApiError("not_found", m, 404),
  conflict: (m = "That action conflicts with the current state.") => new ApiError("conflict", m, 409),
  validation: (details: unknown, m = "Some details are missing or invalid.") =>
    new ApiError("validation_error", m, 422, details),
  rateLimited: (m = "Too many requests. Please slow down.") => new ApiError("rate_limited", m, 429),
  server: (m = "Something went wrong on our side. Please try again.") => new ApiError("server_error", m, 500),
};

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "validation_error", message: "Some details are missing or invalid.", details: err.flatten() } },
      { status: 422 },
    );
  }
  const anyErr = err as { code?: string };
  if (anyErr?.code === "P2002") {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "conflict", message: "That already exists." } },
      { status: 409 },
    );
  }
  if (anyErr?.code === "P2025") {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "not_found", message: "That item could not be found." } },
      { status: 404 },
    );
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code: "server_error", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/** Global, always-on baseline throttle applied to every route through
 *  `handler()` below — keyed by IP, using the RATE_LIMIT_WINDOW_SECONDS/
 *  RATE_LIMIT_MAX config that has existed in env.ts since Phase 1 but was
 *  never actually wired up anywhere. This is deliberately a small, separate
 *  sliding-window bucket rather than importing `rateLimit()` from
 *  src/lib/ratelimit.ts — that module imports `Errors` from this one, and a
 *  handler() this central is not the place to introduce a circular import
 *  for the sake of a five-line function. Endpoint-specific limits (login,
 *  coupon guessing, etc.) still call ratelimit.ts's `rateLimit()` directly
 *  and layer a stricter budget on top of this floor. */
const globalBuckets = new Map<string, { count: number; resetAt: number }>();
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of globalBuckets) if (v.resetAt < now) globalBuckets.delete(k);
  }, 60_000).unref?.();
}

function globalThrottle(req: unknown): void {
  if (!(req instanceof Request)) return;
  const xf = req.headers.get("x-forwarded-for");
  const ip = xf ? xf.split(",")[0]!.trim() : req.headers.get("x-real-ip") ?? "0.0.0.0";
  const now = Date.now();
  const windowMs = env.rateWindowSeconds * 1000;
  const b = globalBuckets.get(ip);
  if (!b || b.resetAt < now) {
    globalBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > env.rateMax) throw Errors.rateLimited();
}

/** Defense-in-depth CSRF check, on top of the primary defense (session
 *  cookies are already SameSite=Lax in src/lib/auth.ts, which modern
 *  browsers refuse to attach to a cross-site POST/PUT/PATCH/DELETE in the
 *  first place). Only acts on state-changing methods, and only when the
 *  browser actually sent an Origin header — a missing Origin is normal for
 *  same-origin top-level navigations in some browsers and for any future
 *  non-cookie API client (bearer-token mobile app, curl), so it is not
 *  treated as suspicious on its own. Compares against the request's own
 *  Host header rather than env.appUrl, since appUrl is known to be capable
 *  of silently defaulting to localhost if unset in production (see env.ts)
 *  and a Host-based check can't be broken by that misconfiguration. The
 *  webhook route intentionally does not go through handler() at all — it
 *  authenticates via gateway signature verification instead, which is the
 *  correct model for a server-to-server callback that will never carry a
 *  matching Origin. */
function sameOriginCheck(req: unknown): void {
  if (!(req instanceof Request)) return;
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (!host) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Errors.forbidden("Request origin could not be verified.");
  }
  if (originHost !== host) throw Errors.forbidden("Cross-origin request blocked.");
}

/** Wrap a route handler so thrown ApiError/ZodError become clean responses,
 *  and every request passes through the global baseline throttle and
 *  same-origin check above. */
export function handler<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      globalThrottle(args[0]);
      sameOriginCheck(args[0]);
      return await fn(...args);
    } catch (err) {
      return fail(err);
    }
  }) as T;
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.validation({ body: "Expected a JSON body." });
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw Errors.validation(result.error.flatten());
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  const result = schema.safeParse(obj);
  if (!result.success) throw Errors.validation(result.error.flatten());
  return result.data;
}
