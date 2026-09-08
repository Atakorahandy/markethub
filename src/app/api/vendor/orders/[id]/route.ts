export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireAuth(req);
  if (!can(s, "orders.manage_own") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const id = idSchema.parse((await params).id);

  const vendorOrder = await prisma.vendorOrder.findUnique({
    where: { id },
    include: {
      items: true,
      history: { orderBy: { createdAt: "asc" } },
      order: { select: { orderNumber: true, recipientName: true, phone: true, streetLine: true, area: true, city: true, region: true, deliveryInstructions: true, createdAt: true } },
    },
  });
  if (!vendorOrder || vendorOrder.vendorId !== s.vendorIds[0]) throw Errors.notFound();
  return ok(vendorOrder);
});
