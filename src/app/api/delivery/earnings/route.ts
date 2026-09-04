export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { agentBalance } from "@/lib/agent-ledger";

export const GET = handler(async (req: Request) => {
  const s = await requireDeliveryAgent(req);

  const [balance, ledger, completedCount] = await Promise.all([
    agentBalance(prisma, s.deliveryAgentId),
    prisma.deliveryAgentLedgerEntry.findMany({ where: { agentId: s.deliveryAgentId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.delivery.count({ where: { agentId: s.deliveryAgentId, status: "delivered" } }),
  ]);

  return ok({ balance, ledger, completedCount });
});
