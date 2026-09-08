export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireDeliveryAgent(req);
  const id = idSchema.parse((await params).id);

  const agent = await prisma.deliveryAgent.findUnique({ where: { id: s.deliveryAgentId } });
  if (!agent || agent.verification !== "verified") throw Errors.forbidden("Your account must be verified before you can accept deliveries.");
  if (agent.status !== "online") throw Errors.conflict("Go online to accept deliveries.");

  const delivery = await prisma.$transaction(async (tx) => {
    // Atomic claim: only succeeds if the job is still unassigned, so two
    // agents racing for the same job can't both win it.
    const claimed = await tx.delivery.updateMany({
      where: { id, status: "pending_assignment" },
      data: { status: "assigned", agentId: s.deliveryAgentId, assignedAt: new Date() },
    });
    if (claimed.count !== 1) throw Errors.conflict("This delivery has already been taken.");

    await tx.deliveryAgent.update({ where: { id: s.deliveryAgentId }, data: { status: "on_delivery" } });
    return tx.delivery.findUniqueOrThrow({ where: { id } });
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "delivery.accepted", entityType: "delivery", entityId: id, meta: { agentId: s.deliveryAgentId } });
  return ok(delivery);
});
