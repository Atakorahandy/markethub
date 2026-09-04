export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { mockSettle, mockSign } from "@/lib/payments/mock";
import { ingestWebhook } from "@/lib/payments/process";

/**
 * DEV/DEMO ONLY — the mock gateway's "hosted page" (/pay/mock/[ref]) posts
 * here to simulate the customer completing (or failing) payment. It then
 * fires a signed webhook through the exact same ingestion path a real
 * provider uses, so the settlement code path is genuinely exercised, not
 * faked client-side.
 */
const schema = z.object({ reference: z.string().min(4), outcome: z.enum(["success", "fail"]).default("success") });

export const POST = handler(async (req: Request) => {
  if (env.paymentProvider !== "mock") throw Errors.forbidden("Mock settlement is disabled.");
  const s = await requireAuth(req);
  const { reference, outcome } = await parseBody(req, schema);

  const payment = await prisma.payment.findFirst({ where: { reference, order: { customerId: s.userId } }, include: { order: true } });
  if (!payment) throw Errors.notFound("Payment not found.");

  mockSettle(reference, outcome === "success" ? "SUCCESSFUL" : "FAILED");

  const body = JSON.stringify({
    id: `mock_evt_${reference}_${Date.now()}`,
    event: outcome === "success" ? "charge.success" : "charge.failed",
    reference,
    amount: payment.amount,
    currency: payment.currency,
  });
  const headers = new Headers({ "content-type": "application/json", "x-mock-signature": mockSign(body) });
  const result = await ingestWebhook(body, headers);

  return ok({ settled: outcome, webhook: result, orderNumber: payment.order.orderNumber });
});
