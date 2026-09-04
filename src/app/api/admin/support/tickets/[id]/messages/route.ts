export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "disputes.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound();

  // A staff reply moves an open ticket to "pending" (waiting on the
  // customer) — assigning it to the responder if nobody had claimed it yet.
  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: id, authorId: s.userId, authorName: s.name, authorRole: "staff", body: body.body } }),
    prisma.supportTicket.update({
      where: { id },
      data: { status: "pending", assignedToId: ticket.assignedToId ?? s.userId },
    }),
  ]);

  await audit({ req, actorId: s.userId, actorName: s.name, action: "support_ticket.staff_replied", entityType: "supportTicket", entityId: id });
  return ok(message, 201);
});
