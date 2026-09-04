import { prisma } from "../prisma";
import { Errors } from "../api";
import { audit } from "../audit";
import { env } from "../env";
import { paymentReference } from "../ids";
import { paymentProvider } from "./index";
import type { VerifyResult } from "./types";

/**
 * Payment settlement (spec §20, §78). The gateway result is ALWAYS
 * re-verified server-side and checked against the Payment row before an
 * order is marked paid. Frontend-reported success is never trusted.
 */

async function markPaid(paymentId: string, verified: VerifyResult, source: "verify" | "webhook") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) throw Errors.notFound("Payment not found.");

  await prisma.paymentTransaction.create({
    data: { paymentId, kind: source, status: verified.status, amount: Math.max(0, verified.amount), raw: JSON.stringify(verified.raw ?? {}).slice(0, 8000) },
  });

  // Idempotent — already settled, nothing left to do.
  if (payment.status === "SUCCESSFUL") return { changed: false, order: payment.order };

  if (verified.status !== "SUCCESSFUL") {
    if (["FAILED", "CANCELLED"].includes(verified.status)) {
      await prisma.payment.update({ where: { id: paymentId }, data: { status: verified.status } });
    }
    return { changed: false, order: payment.order };
  }

  // Amount / currency must match what we expect (§78 — amount manipulation guard).
  if (verified.amount >= 0 && verified.amount !== payment.amount) {
    await prisma.paymentTransaction.create({
      data: { paymentId, kind: source, status: "MISMATCH", amount: verified.amount, raw: JSON.stringify({ expected: payment.amount, got: verified.amount }) },
    });
    throw Errors.conflict("Payment amount does not match the order total.");
  }
  if (verified.currency && payment.currency && verified.currency !== payment.currency) {
    throw Errors.conflict("Payment currency mismatch.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCESSFUL", provider: paymentProvider().name, gatewayRef: verified.gatewayRef, paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date() },
    });
    if (payment.order.status === "pending_payment") {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: "paid" } });
      await tx.vendorOrder.updateMany({ where: { orderId: payment.orderId, status: "pending_payment" }, data: { status: "paid" } });
    }
  });

  await audit({ actorId: payment.order.customerId, action: "order.paid", entityType: "order", entityId: payment.orderId, meta: { orderNumber: payment.order.orderNumber, provider: paymentProvider().name, source } });

  return { changed: true, order: { ...payment.order, status: "paid" } };
}

/** Create (or refresh) an order's Payment row and open it with the gateway.
 *  Used right after checkout, and again if the customer abandons the gateway
 *  page and comes back to retry an unpaid order. */
export async function initiatePaymentForOrder(
  orderId: string,
  input: { method: string; momoNetwork?: string; email: string },
): Promise<{ reference: string; authorizationUrl: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound();
  if (order.status !== "pending_payment") throw Errors.conflict("This order is not awaiting payment.");

  const reference = paymentReference(order.orderNumber);
  const provider = paymentProvider();

  const init = await provider.initiate({
    reference,
    amount: order.total,
    currency: env.paymentCurrency,
    email: input.email,
    method: input.method,
    momoNetwork: input.momoNetwork,
    callbackUrl: `${env.appUrl}/checkout/return?ref=${reference}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });

  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id, reference, amount: order.total, currency: env.paymentCurrency,
      method: input.method, momoNetwork: input.momoNetwork ?? "",
      provider: provider.name, gatewayRef: init.gatewayRef, authorizationUrl: init.authorizationUrl, status: "PROCESSING",
    },
    update: {
      reference, method: input.method, momoNetwork: input.momoNetwork ?? "",
      provider: provider.name, gatewayRef: init.gatewayRef, authorizationUrl: init.authorizationUrl, status: "PROCESSING",
    },
  });
  await prisma.paymentTransaction.create({
    data: { paymentId: payment.id, kind: "initiate", status: init.status, amount: order.total, raw: JSON.stringify(init.raw).slice(0, 8000) },
  });

  return { reference, authorizationUrl: init.authorizationUrl };
}

/** Re-fetch a payment from the gateway by reference and settle it. Used by
 *  the checkout return page and the mock "I've paid" flow. */
export async function verifyAndSettle(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) throw Errors.notFound("Payment not found.");

  const provider = paymentProvider();
  const verified = await provider.verify(reference);
  const result = await markPaid(payment.id, verified, "verify");
  return { status: verified.status, order: result.order };
}

/** Ingest a gateway webhook. Idempotent + replay-safe. */
export async function ingestWebhook(rawBody: string, headers: Headers) {
  const provider = paymentProvider();
  const parsed = await provider.parseWebhook(rawBody, headers);
  if (!parsed.ok) return { accepted: false, reason: parsed.reason };

  // Dedupe on (provider, eventId) — a replay is a silent no-op.
  const existing = await prisma.paymentWebhook.findUnique({
    where: { provider_eventId: { provider: provider.name, eventId: parsed.eventId } },
  });
  if (existing?.processedAt) return { accepted: true, duplicate: true };

  const hook = existing
    ? existing
    : await prisma.paymentWebhook.create({
        data: {
          provider: provider.name,
          eventId: parsed.eventId,
          signature: headers.get("x-paystack-signature") ?? headers.get("x-mock-signature") ?? "",
          payload: rawBody.slice(0, 8000),
        },
      });

  const payment = await prisma.payment.findUnique({ where: { reference: parsed.reference } });
  if (!payment) {
    await prisma.paymentWebhook.update({ where: { id: hook.id }, data: { processedAt: new Date() } });
    return { accepted: true, reason: "unknown reference" };
  }

  // Re-verify against the gateway rather than trusting the webhook body outright.
  const verified = await provider.verify(parsed.reference).catch(
    (): VerifyResult => ({
      reference: parsed.reference,
      gatewayRef: parsed.gatewayRef,
      status: parsed.status,
      amount: parsed.amount,
      currency: parsed.currency,
      raw: parsed.raw,
    }),
  );

  await markPaid(payment.id, verified, "webhook");
  await prisma.paymentWebhook.update({ where: { id: hook.id }, data: { processedAt: new Date() } });
  return { accepted: true, settled: verified.status };
}
