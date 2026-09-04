export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";

const querySchema = z.object({ status: z.enum(["open", "pending", "resolved", "closed"]).optional() });

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "disputes.manage");
  const { status } = parseQuery(req, querySchema);

  const items = await prisma.supportTicket.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: "desc" },
    include: { assignedTo: { select: { name: true } }, _count: { select: { messages: true } } },
  });
  return ok({ items });
});
