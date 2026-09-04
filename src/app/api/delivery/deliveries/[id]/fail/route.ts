export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ reason: z.string().trim().min(3).max(300) });

export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireDeliveryAgent(req);
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery || delivery.agentId !== s.deliveryAgentId) throw Errors.notFound();
  if (!["assigned", "picked_up", "out_for_delivery"].includes(delivery.status)) {
    throw Errors.conflict("This delivery can no longer be reported as failed.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({ where: { id }, data: { status: "failed", failedAt: new Date(), failureReason: body.reason } });
    await tx.deliveryAgent.update({ where: { id: s.deliveryAgentId }, data: { status: "online" } });
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "delivery.failed", entityType: "delivery", entityId: id, meta: { reason: body.reason } });
  return ok({ ok: true });
});
