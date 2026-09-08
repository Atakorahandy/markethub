export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ verification: z.enum(["verified", "rejected"]) });

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requirePlatform(req, "deliveries.manage");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const agent = await prisma.deliveryAgent.update({ where: { id }, data: { verification: body.verification } });

  await audit({
    req,
    actorId: s.userId,
    actorName: s.name,
    action: `delivery_agent.${body.verification}`,
    entityType: "delivery_agent",
    entityId: agent.id,
  });

  return ok(agent);
});
