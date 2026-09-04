import { createHmac } from "crypto";
import { env } from "../env";
import type { PaymentProvider, InitiateInput, InitiateResult, VerifyResult, WebhookParseResult } from "./types";

/**
 * MOCK payment provider — fully working, deterministic, no external calls.
 * Used for demo, local dev and tests. It mimics a real gateway:
 *   • initiate() returns a hosted-page URL (our own /pay/mock/[ref] screen)
 *   • verify() reports whatever the mock page last set via mockSettle()
 *   • parseWebhook() validates an HMAC signature exactly like a real provider
 *
 * The mock "secret" is the JWT access secret so signatures are stable per-env.
 */
const SECRET = `mock_${env.jwtAccessSecret}`;

export function mockSign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

const store = new Map<string, { amount: number; currency: string; status: VerifyResult["status"] }>();

export const mockProvider: PaymentProvider = {
  name: "mock",
  isConfigured: () => true,

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    store.set(input.reference, { amount: input.amount, currency: input.currency, status: "PENDING" });
    return {
      provider: "mock",
      gatewayRef: `mock_${input.reference}`,
      authorizationUrl: `${env.appUrl}/pay/mock/${input.reference}`,
      status: "PENDING",
      raw: { simulated: true, method: input.method, momoNetwork: input.momoNetwork ?? null },
    };
  },

  async verify(reference: string): Promise<VerifyResult> {
    const rec = store.get(reference);
    return {
      reference,
      gatewayRef: `mock_${reference}`,
      status: rec?.status ?? "PENDING",
      amount: rec?.amount ?? -1,
      currency: rec?.currency ?? env.paymentCurrency,
      paidAt: rec?.status === "SUCCESSFUL" ? new Date().toISOString() : undefined,
      raw: { simulated: true },
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookParseResult> {
    const sig = headers.get("x-mock-signature") ?? "";
    if (!sig || sig !== mockSign(rawBody)) return { ok: false, reason: "bad signature" };
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "invalid json" };
    }
    if (!body.reference || !body.event) return { ok: false, reason: "missing fields" };
    const status: VerifyResult["status"] = body.event === "charge.success" ? "SUCCESSFUL" : "FAILED";
    return {
      ok: true,
      eventId: body.id ?? `mock_evt_${body.reference}`,
      reference: body.reference,
      gatewayRef: `mock_${body.reference}`,
      status,
      amount: Number(body.amount ?? -1),
      currency: body.currency ?? env.paymentCurrency,
      raw: body,
    };
  },
};

/** The mock pay page calls this to advance a transaction so verify() reflects it. */
export function mockSettle(reference: string, status: VerifyResult["status"]): void {
  const rec = store.get(reference) ?? { amount: -1, currency: env.paymentCurrency, status: "PENDING" as const };
  store.set(reference, { ...rec, status });
}
