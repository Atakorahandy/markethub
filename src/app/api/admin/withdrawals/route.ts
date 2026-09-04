export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";

const querySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "completed"]).optional(),
});

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "withdrawals.view");
  const { status } = parseQuery(req, querySchema);

  const items = await prisma.withdrawal.findMany({
    where: status ? { status } : {},
    orderBy: { requestedAt: "desc" },
    include: { vendor: { select: { businessName: true, slug: true } } },
  });
  return ok({ items });
});
