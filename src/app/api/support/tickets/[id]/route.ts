export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireAuth(req);
  const id = idSchema.parse((await params).id);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket || ticket.openedById !== s.userId) throw Errors.notFound();
  return ok(ticket);
});
