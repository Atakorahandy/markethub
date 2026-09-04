import { Errors } from "./api";

/**
 * Process-local sliding-window rate limiter. Good enough for a single Node
 * instance and for early phases; swap for a Redis token bucket when running
 * multiple instances (the call sites do not change).
 */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, max: number, windowSeconds: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  b.count += 1;
  if (b.count > max) throw Errors.rateLimited();
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

// periodic cleanup so the map does not grow forever
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }, 60_000).unref?.();
}
