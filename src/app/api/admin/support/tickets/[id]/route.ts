export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request, { params }: { params: { id: string } }) => {
  await requirePlatform(req, "disputes.manage");
  const id = idSchema.parse(params.id);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } }, assignedTo: { select: { name: true } } },
  });
  if (!ticket) throw Errors.notFound();
  return ok(ticket);
});

const schema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  assignToMe: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "disputes.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound();

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.assignToMe ? { assignedToId: s.userId } : {}),
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "support_ticket.updated", entityType: "supportTicket", entityId: id, meta: body });
  return ok(updated);
});
