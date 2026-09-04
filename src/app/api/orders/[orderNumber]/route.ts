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
        include: { items: true, vendor: { select: { businessName: true, slug: true, phone: true } } },
      },
      payment: { select: { status: true, method: true, momoNetwork: true, authorizationUrl: true } },
    },
  });
  if (!order || order.customerId !== s.userId) throw Errors.notFound();
  return ok(order);
});
