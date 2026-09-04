export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { creditVendorForDelivery } from "@/lib/fulfilment";
import { agentLedgerMove } from "@/lib/agent-ledger";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ otp: z.string().trim().length(4) });

export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireDeliveryAgent(req);
  const id = idSchema.parse(params.id);
  // A 4-digit code has only 10,000 combinations — bound how fast it can be guessed.
  rateLimit(`delivery-otp:${id}`, 8, 300);
  const body = await parseBody(req, schema);

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { vendorOrder: { include: { vendor: true } } },
  });
  if (!delivery || delivery.agentId !== s.deliveryAgentId) throw Errors.notFound();
  if (delivery.status !== "out_for_delivery") throw Errors.conflict('Mark the delivery "out for delivery" before confirming with the customer.');
  if (body.otp !== delivery.otpCode) throw Errors.validation({ otp: "mismatch" }, "That code doesn't match. Ask the customer to double-check.");

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.delivery.update({ where: { id }, data: { status: "delivered", deliveredAt: now, otpVerifiedAt: now } });
    await tx.vendorOrder.update({ where: { id: delivery.vendorOrderId }, data: { status: "delivered" } });
    await tx.vendorOrderStatusHistory.create({
      data: { vendorOrderId: delivery.vendorOrderId, status: "delivered", note: "Confirmed by delivery agent (OTP)", actorId: s.userId, actorName: s.name },
    });
    await creditVendorForDelivery(tx, delivery.vendorOrder);
    await agentLedgerMove(tx, { agentId: s.deliveryAgentId, type: "delivery_earning", amount: delivery.agentEarning, note: `Delivery ${id}`, deliveryId: id });
    await tx.deliveryAgent.update({ where: { id: s.deliveryAgentId }, data: { status: "online" } });
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "delivery.confirmed", entityType: "delivery", entityId: id });
  return ok({ ok: true });
});
