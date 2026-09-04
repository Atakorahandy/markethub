export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";

/** Unassigned delivery jobs, visible to any verified agent who's online. */
export const GET = handler(async (req: Request) => {
  const s = await requireDeliveryAgent(req);
  const agent = await prisma.deliveryAgent.findUnique({ where: { id: s.deliveryAgentId } });
  if (!agent || agent.verification !== "verified") throw Errors.forbidden("Your account must be verified before you can see delivery jobs.");
  if (agent.status !== "online") return ok({ items: [] });

  const items = await prisma.delivery.findMany({
    where: { status: "pending_assignment" },
    orderBy: { createdAt: "asc" },
    include: {
      vendorOrder: {
        include: {
          vendor: { select: { businessName: true, city: true, region: true } },
          order: { select: { orderNumber: true, city: true, region: true } },
          items: { select: { quantity: true } },
        },
      },
    },
    take: 50,
  });
  return ok({ items });
});
