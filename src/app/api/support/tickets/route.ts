export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

/** Any authenticated user can open a ticket — customer, vendor, or delivery
 *  agent — so this deliberately isn't gated behind a specific permission,
 *  the same way viewing your own account isn't. */
export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const items = await prisma.supportTicket.findMany({
    where: { openedById: s.userId },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ items });
});

const schema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(["general", "order", "payment", "vendor", "other"]).default("general"),
  orderNumber: z.string().trim().max(20).optional(),
  message: z.string().trim().min(1).max(4000),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  rateLimit(`support-ticket:${s.userId}`, 10, 3600);
  const body = await parseBody(req, schema);

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: body.subject,
      category: body.category,
      orderNumber: body.orderNumber ?? "",
      openedById: s.userId,
      openedByName: s.name,
      messages: { create: { authorId: s.userId, authorName: s.name, authorRole: "customer", body: body.message } },
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "support_ticket.opened", entityType: "supportTicket", entityId: ticket.id });
  return ok(ticket, 201);
});
