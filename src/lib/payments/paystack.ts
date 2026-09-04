import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../env";
import type { PaymentProvider, InitiateInput, InitiateResult, VerifyResult, WebhookParseResult } from "./types";

/**
 * Paystack payment provider (spec §20) — cards + Mobile Money (MTN, Telecel,
 * AirtelTigo) for Ghana.
 *
 * Flow: initiate() opens a Paystack-hosted checkout (`authorization_url`)
 * filtered to the channel the customer picked. The customer completes there
 * (MoMo prompt on their phone / card form), Paystack redirects back to our
 * callback, and settlement is confirmed by BOTH the `charge.success` webhook
 * and a server-side verify() — never the redirect alone (spec §20, §78).
 *
 * Amounts: Paystack uses the currency's minor unit (pesewas for GHS), which
 * is exactly how MarketHub stores money — no conversion needed.
 *
 * Config: PAYMENT_PROVIDER=paystack + PAYSTACK_SECRET_KEY (sk_live_… / sk_test_…).
 * Webhooks are signed with the secret key itself, so PAYSTACK_WEBHOOK_SECRET is
 * optional (falls back to the secret key). Register the webhook URL
 *   https://<your-domain>/api/payments/webhook
 * in Paystack → Settings → API Keys & Webhooks.
 */
const BASE = "https://api.paystack.co";

/** Our MoMo network codes → Paystack's `mobile_money.provider` codes. */
export const MOMO_PROVIDER_CODE: Record<string, string> = {
  mtn: "mtn",
  telecel: "vod", // Telecel took over Vodafone Ghana; Paystack still uses "vod"
  airteltigo: "atl",
};

function channelsFor(method: string): string[] {
  return method === "momo" ? ["mobile_money"] : ["card"];
}

async function ps(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(`paystack ${path}: ${json.message ?? res.statusText ?? res.status}`);
  }
  return json.data;
}

function mapStatus(s: string): VerifyResult["status"] {
  switch (s) {
    case "success":
      return "SUCCESSFUL";
    case "failed":
    case "reversed":
      return "FAILED";
    case "abandoned":
      return "CANCELLED";
    case "ongoing":
    case "pending":
    case "processing":
    case "queued":
      return "PROCESSING";
    default:
      return "PENDING";
  }
}

export const paystackProvider: PaymentProvider = {
  name: "paystack",
  isConfigured: () => env.paystackSecretKey.startsWith("sk_"),

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const data = await ps("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        reference: input.reference,
        amount: input.amount, // pesewas
        currency: input.currency,
        email: input.email,
        callback_url: input.callbackUrl,
        channels: channelsFor(input.method),
        metadata: {
          ...(input.metadata ?? {}),
          method: input.method,
          momoNetwork: input.momoNetwork ?? null,
        },
      }),
    });
    return {
      provider: "paystack",
      gatewayRef: String(data.reference ?? input.reference),
      authorizationUrl: data.authorization_url ?? "",
      status: "PENDING",
      raw: data,
    };
  },

  async verify(reference: string): Promise<VerifyResult> {
    const data = await ps(`/transaction/verify/${encodeURIComponent(reference)}`);
    const amount = Number(data.amount);
    return {
      reference,
      gatewayRef: String(data.id ?? data.reference),
      status: mapStatus(String(data.status ?? "")),
      amount: Number.isFinite(amount) ? amount : -1,
      currency: data.currency ?? env.paymentCurrency,
      paidAt: data.paid_at ?? data.paidAt ?? undefined,
      raw: data,
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookParseResult> {
    const sig = headers.get("x-paystack-signature") ?? "";
    const expected = createHmac("sha512", env.paystackWebhookSecret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad signature" };

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "invalid json" };
    }
    const d = body.data ?? {};
    if (!d.reference) return { ok: false, reason: "missing reference" };

    const amount = Number(d.amount);
    return {
      ok: true,
      // Paystack has no stable top-level event id — dedupe on event + transaction id.
      eventId: `${body.event}::${d.id ?? d.reference}`,
      reference: String(d.reference),
      gatewayRef: String(d.id ?? d.reference),
      status: body.event === "charge.success" ? "SUCCESSFUL" : mapStatus(String(d.status ?? "")),
      amount: Number.isFinite(amount) ? amount : -1,
      currency: d.currency ?? env.paymentCurrency,
      raw: body,
    };
  },
};
