/**
 * Provider-agnostic payment contract (spec §19). No provider is hard-coded;
 * the registry in ./index.ts picks one from PAYMENT_PROVIDER. Never trust a
 * payment result that has not been verified server-side (spec §20, §78).
 */

export type InitiateInput = {
  reference: string;
  amount: number; // pesewas — authoritative
  currency: string;
  email: string;
  method: string; // card | momo
  momoNetwork?: string; // mtn | telecel | airteltigo
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type InitiateResult = {
  provider: string;
  gatewayRef: string;
  /** URL to send the customer to. */
  authorizationUrl: string;
  status: "PENDING" | "PROCESSING";
  raw: Record<string, unknown>;
};

export type VerifyResult = {
  reference: string;
  gatewayRef: string;
  status: "SUCCESSFUL" | "FAILED" | "PENDING" | "PROCESSING" | "CANCELLED";
  amount: number; // pesewas as reported by the gateway
  currency: string;
  paidAt?: string;
  raw: Record<string, unknown>;
};

export type WebhookParseResult =
  | {
      ok: true;
      eventId: string;
      reference: string;
      gatewayRef: string;
      status: VerifyResult["status"];
      amount: number;
      currency: string;
      raw: Record<string, unknown>;
    }
  | { ok: false; reason: string };

export interface PaymentProvider {
  name: string;
  /** True when keys are present and the provider can transact. */
  isConfigured(): boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Re-fetch the transaction from the gateway. The ONLY source of truth. */
  verify(reference: string): Promise<VerifyResult>;
  /** Validate signature + shape of an inbound webhook. Must be pure/side-effect free. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookParseResult>;
}
