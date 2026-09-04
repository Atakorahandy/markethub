export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

const querySchema = paginationSchema.extend({
  verification: z.enum(["pending", "verified", "rejected"]).optional(),
});

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "deliveries.view");
  const { page, pageSize, verification } = parseQuery(req, querySchema);

  const where = verification ? { verification } : {};

  const [items, total] = await Promise.all([
    prisma.deliveryAgent.findMany({
      where,
      include: { user: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.deliveryAgent.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
