export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireDeliveryAgent(req);
  const agent = await prisma.deliveryAgent.findUnique({
    where: { id: s.deliveryAgentId },
    select: { id: true, status: true, verification: true, vehicleType: true, city: true, region: true, createdAt: true },
  });
  return ok(agent);
});
