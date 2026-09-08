/**
 * Central environment access. Fails fast in production if a required secret is
 * missing; in development it falls back to obviously-insecure placeholders so a
 * fresh clone runs without ceremony.
 */
const isProd = process.env.NODE_ENV === "production";

function req(name: string, devFallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const env = {
  isProd,
  databaseUrl: req("DATABASE_URL", "postgresql://markethub:markethub@localhost:5432/markethub"),
  jwtAccessSecret: req("JWT_ACCESS_SECRET", "dev-access-secret-please-change-0000000000"),
  jwtRefreshSecret: req("JWT_REFRESH_SECRET", "dev-refresh-secret-please-change-000000000"),
  accessTtl: Number(process.env.ACCESS_TOKEN_TTL ?? 900),
  refreshTtl: Number(process.env.REFRESH_TOKEN_TTL ?? 60 * 60 * 24 * 30),
  appName: process.env.APP_NAME ?? "MarketHub",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
  rateWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
  rateMax: Number(process.env.RATE_LIMIT_MAX ?? 120),
  seedSuperadminEmail: process.env.SEED_SUPERADMIN_EMAIL ?? "admin@markethub.app",
  seedSuperadminPassword: process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!Admin123",
  // Payments — provider-agnostic. MOCK needs no keys (default in dev).
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase(),
  paymentCurrency: process.env.PAYMENT_CURRENCY ?? "GHS",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || "",
  // CAPTCHA — provider-agnostic, same "none unless configured" shape as
  // payments. NONE (default) requires no keys and no code path checks a
  // token; TURNSTILE additionally needs TURNSTILE_SECRET_KEY server-side
  // and NEXT_PUBLIC_TURNSTILE_SITE_KEY client-side to render the widget.
  captchaProvider: (process.env.CAPTCHA_PROVIDER ?? "none").toLowerCase(),
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
};
