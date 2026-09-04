export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAuth(req);
  rateLimit(`support-message:${s.userId}`, 30, 300);
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || ticket.openedById !== s.userId) throw Errors.notFound();
  if (ticket.status === "closed") throw Errors.conflict("This ticket is closed. Open a new one if you still need help.");

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: id, authorId: s.userId, authorName: s.name, authorRole: "customer", body: body.body } }),
    // A customer reply on a ticket staff had marked "resolved" reopens it.
    prisma.supportTicket.update({ where: { id }, data: { status: ticket.status === "resolved" ? "open" : ticket.status } }),
  ]);

  await audit({ req, actorId: s.userId, actorName: s.name, action: "support_ticket.replied", entityType: "supportTicket", entityId: id });
  return ok(message, 201);
});
