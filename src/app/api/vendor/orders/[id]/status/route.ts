export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { VENDOR_ORDER_STATUS_FLOW, DEFAULT_COMMISSION_BPS } from "@/lib/constants";
import { applyBps } from "@/lib/money";
import { walletMove } from "@/lib/wallet";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["processing", "shipped", "delivered"]),
  note: z.string().trim().max(300).optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAuth(req);
  if (!can(s, "orders.manage_own") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const vendorOrder = await prisma.vendorOrder.findUnique({ where: { id }, include: { vendor: true } });
  if (!vendorOrder || vendorOrder.vendorId !== s.vendorIds[0]) throw Errors.notFound();

  const currentIdx = VENDOR_ORDER_STATUS_FLOW.indexOf(vendorOrder.status as (typeof VENDOR_ORDER_STATUS_FLOW)[number]);
  const targetIdx = VENDOR_ORDER_STATUS_FLOW.indexOf(body.status);
  if (currentIdx === -1 || targetIdx !== currentIdx + 1) {
    throw Errors.conflict(`Cannot move from "${vendorOrder.status}" to "${body.status}". Orders advance one step at a time: ${VENDOR_ORDER_STATUS_FLOW.join(" → ")}.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const vo = await tx.vendorOrder.update({ where: { id }, data: { status: body.status } });
    await tx.vendorOrderStatusHistory.create({
      data: { vendorOrderId: id, status: body.status, note: body.note ?? "", actorId: s.userId, actorName: s.name },
    });

    if (body.status === "delivered" && !vendorOrder.walletCreditedAt) {
      const commissionBps = vendorOrder.vendor.commissionBps ?? DEFAULT_COMMISSION_BPS;
      const gross = vendorOrder.subtotal + vendorOrder.deliveryFee;
      const commission = applyBps(vendorOrder.subtotal, commissionBps);

      await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "sale", amount: gross, note: `Order ${id}`, vendorOrderId: id });
      await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "commission", amount: -commission, note: `Platform commission (${commissionBps / 100}%)`, vendorOrderId: id });
      await tx.vendorOrder.update({ where: { id }, data: { walletCreditedAt: new Date() } });
    }

    return vo;
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: `vendor_order.${body.status}`, entityType: "vendor_order", entityId: id, meta: { vendorId: vendorOrder.vendorId } });
  return ok(updated);
});
