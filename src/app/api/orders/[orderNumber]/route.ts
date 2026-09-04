export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

export const GET = handler(async (req: Request, { params }: { params: { orderNumber: string } }) => {
  const s = await requireAuth(req);

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: {
      vendorOrders: {
        include: {
          items: true,
          vendor: { select: { businessName: true, slug: true, phone: true } },
          delivery: {
            select: {
              status: true, otpCode: true, assignedAt: true, pickedUpAt: true, outForDeliveryAt: true, deliveredAt: true,
              agent: { select: { user: { select: { name: true, phone: true } } } },
            },
          },
        },
      },
      payment: { select: { status: true, method: true, momoNetwork: true, authorizationUrl: true } },
    },
  });
  if (!order || order.customerId !== s.userId) throw Errors.notFound();

  // Only surface the confirmation code once it's actually useful (out for
  // delivery) — no point showing it while the parcel is still with the vendor.
  const vendorOrders = order.vendorOrders.map((vo) => ({
    ...vo,
    delivery: vo.delivery ? { ...vo.delivery, otpCode: vo.delivery.status === "out_for_delivery" ? vo.delivery.otpCode : null } : null,
  }));

  return ok({ ...order, vendorOrders });
});
