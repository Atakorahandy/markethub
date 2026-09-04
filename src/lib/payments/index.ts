import { env } from "../env";
import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";

const REGISTRY: Record<string, PaymentProvider> = {
  mock: mockProvider,
  paystack: paystackProvider,
};

/**
 * Resolve the active payment provider (spec §19 — never hard-code one). Falls
 * back to the mock provider when the configured provider has no keys, so the
 * app is always transactable in dev/demo.
 */
export function paymentProvider(): PaymentProvider {
  const chosen = REGISTRY[env.paymentProvider];
  if (chosen && chosen.isConfigured()) return chosen;
  if (chosen && !chosen.isConfigured()) {
    console.warn(`[payments] provider "${env.paymentProvider}" not configured — using mock`);
  }
  return mockProvider;
}

export * from "./types";
