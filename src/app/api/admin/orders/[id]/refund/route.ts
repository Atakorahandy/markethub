export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { walletMove } from "@/lib/wallet";
import { audit } from "@/lib/audit";

const schema = z.object({ reason: z.string().trim().min(5).max(300) });

const NOT_REFUNDABLE = new Set(["pending_payment", "cancelled", "refunded"]);

// Full-order-amount refund only (schema comment explains why). If the vendor
// had already been paid out for this order, the exact sale + commission
// ledger entries `creditVendorForDelivery` created are reversed so the
// vendor's balance ends up exactly where it would be had the sale never
// happened — never a bare balance edit.
export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "orders.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const vendorOrder = await prisma.vendorOrder.findUnique({ where: { id } });
  if (!vendorOrder) throw Errors.notFound();
  if (NOT_REFUNDABLE.has(vendorOrder.status)) {
    throw Errors.conflict(`A "${vendorOrder.status}" order cannot be refunded.`);
  }

  await prisma.$transaction(async (tx) => {
    const walletReversed = !!vendorOrder.walletCreditedAt;
    if (walletReversed) {
      const gross = vendorOrder.subtotal + vendorOrder.deliveryFee;
      // Mirror-image of creditVendorForDelivery's two entries, so the net
      // effect on the vendor's balance is exactly -(gross - commission) —
      // whatever they were actually paid out for this order.
      const priorCommission = await tx.walletLedgerEntry.aggregate({
        where: { vendorId: vendorOrder.vendorId, vendorOrderId: id, type: "commission" },
        _sum: { amount: true },
      });
      const commission = -(priorCommission._sum.amount ?? 0); // stored negative; flip to positive
      await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "refund_clawback", amount: -gross, note: `Refund of order ${id}`, vendorOrderId: id });
      await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "refund_commission_return", amount: commission, note: `Commission returned on refunded order ${id}`, vendorOrderId: id });
    }

    await tx.vendorOrder.update({ where: { id }, data: { status: "refunded" } });
    await tx.vendorOrderStatusHistory.create({
      data: { vendorOrderId: id, status: "refunded", note: body.reason, actorId: s.userId, actorName: s.name },
    });
    await tx.refund.create({
      data: {
        vendorOrderId: id,
        amount: vendorOrder.total,
        reason: body.reason,
        walletReversed,
        processedById: s.userId,
        processedByName: s.name,
      },
    });
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "order.refunded", entityType: "vendorOrder", entityId: id, meta: { amount: vendorOrder.total } });
  return ok({ ok: true });
});
