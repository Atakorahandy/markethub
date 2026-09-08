import { env } from "./env";

/** Provider-agnostic CAPTCHA gate, mirroring src/lib/payments' "none unless
 *  configured" shape. Default is `none` — every call site below is a
 *  no-op until CAPTCHA_PROVIDER=turnstile + TURNSTILE_SECRET_KEY are set,
 *  so a fresh clone (and every environment until the operator opts in)
 *  behaves exactly as it did before this existed. */
export function captchaEnabled(): boolean {
  return env.captchaProvider === "turnstile" && !!env.turnstileSecretKey;
}

/** Verifies a Cloudflare Turnstile token server-side — the client-supplied
 *  token is never trusted on its own, only what Cloudflare's own siteverify
 *  endpoint confirms about it (same "never trust the client" discipline as
 *  payment verification elsewhere in this codebase). */
export async function verifyCaptcha(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
  if (!captchaEnabled()) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret: env.turnstileSecretKey, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({ success: false }));
    return data.success === true;
  } catch {
    // Cloudflare unreachable/timed out — fail closed, same as any other
    // security check whose verifier can't be reached.
    return false;
  }
}
