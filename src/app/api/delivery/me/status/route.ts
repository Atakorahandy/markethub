export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireDeliveryAgent } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["online", "offline"]) });

export const PATCH = handler(async (req: Request) => {
  const s = await requireDeliveryAgent(req);
  const body = await parseBody(req, schema);

  const agent = await prisma.deliveryAgent.findUnique({ where: { id: s.deliveryAgentId } });
  if (!agent) throw Errors.notFound();
  if (agent.verification !== "verified") throw Errors.forbidden("Your account must be verified before you can go online.");
  if (agent.status === "on_delivery") throw Errors.conflict("Finish your active delivery before going offline.");

  const updated = await prisma.deliveryAgent.update({ where: { id: s.deliveryAgentId }, data: { status: body.status } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: `delivery_agent.${body.status}`, entityType: "delivery_agent", entityId: s.deliveryAgentId });
  return ok(updated);
});
