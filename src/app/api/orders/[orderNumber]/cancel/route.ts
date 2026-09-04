export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request, { params }: { params: { orderNumber: string } }) => {
  const s = await requireAuth(req);

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: { vendorOrders: { include: { items: true } } },
  });
  if (!order || order.customerId !== s.userId) throw Errors.notFound();
  if (order.status !== "pending_payment") throw Errors.conflict("Only unpaid orders can be cancelled.");

  await prisma.$transaction(async (tx) => {
    for (const vo of order.vendorOrders) {
      for (const item of vo.items) {
        if (item.variantId) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        } else {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }
    await tx.vendorOrder.updateMany({ where: { orderId: order.id }, data: { status: "cancelled" } });
    await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED" } });
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "order.cancelled", entityType: "order", entityId: order.id, meta: { orderNumber: order.orderNumber } });
  return ok({ ok: true });
});
