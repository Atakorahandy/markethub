export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const GET = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireDeliveryAgent(req);
  const id = idSchema.parse(params.id);

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      vendorOrder: {
        include: {
          vendor: { select: { businessName: true, addressLine: true, city: true, region: true, phone: true } },
          order: { select: { orderNumber: true, recipientName: true, phone: true, streetLine: true, area: true, city: true, region: true, deliveryInstructions: true } },
          items: { select: { nameSnapshot: true, quantity: true } },
        },
      },
    },
  });
  if (!delivery || delivery.agentId !== s.deliveryAgentId) throw Errors.notFound();
  return ok(delivery);
});
