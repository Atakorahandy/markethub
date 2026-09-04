export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

const querySchema = paginationSchema.extend({
  status: z.enum(["draft", "pending_review", "active", "rejected", "out_of_stock", "suspended"]).optional(),
});

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "products.view");
  const { page, pageSize, q, status } = parseQuery(req, querySchema);

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { vendor: { select: { businessName: true, slug: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.product.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
