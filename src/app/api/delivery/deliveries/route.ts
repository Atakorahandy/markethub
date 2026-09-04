export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";

const querySchema = z.object({
  status: z.enum(["assigned", "picked_up", "out_for_delivery", "delivered", "failed"]).optional(),
});

export const GET = handler(async (req: Request) => {
  const s = await requireDeliveryAgent(req);
  const { status } = parseQuery(req, querySchema);

  const items = await prisma.delivery.findMany({
    where: { agentId: s.deliveryAgentId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      vendorOrder: {
        include: {
          vendor: { select: { businessName: true, city: true, region: true } },
          order: { select: { orderNumber: true, recipientName: true, phone: true, streetLine: true, area: true, city: true, region: true } },
          items: { select: { quantity: true } },
        },
      },
    },
  });
  return ok({ items });
});
