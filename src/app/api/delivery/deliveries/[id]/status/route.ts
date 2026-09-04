export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { DELIVERY_STATUS_FLOW } from "@/lib/constants";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["picked_up", "out_for_delivery"]) });

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireDeliveryAgent(req);
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery || delivery.agentId !== s.deliveryAgentId) throw Errors.notFound();

  const currentIdx = DELIVERY_STATUS_FLOW.indexOf(delivery.status as (typeof DELIVERY_STATUS_FLOW)[number]);
  const targetIdx = DELIVERY_STATUS_FLOW.indexOf(body.status);
  if (currentIdx === -1 || targetIdx !== currentIdx + 1) {
    throw Errors.conflict(`Cannot move from "${delivery.status}" to "${body.status}".`);
  }

  const timestampField = body.status === "picked_up" ? "pickedUpAt" : "outForDeliveryAt";
  const updated = await prisma.delivery.update({ where: { id }, data: { status: body.status, [timestampField]: new Date() } });

  await audit({ req, actorId: s.userId, actorName: s.name, action: `delivery.${body.status}`, entityType: "delivery", entityId: id });
  return ok(updated);
});
