export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

const querySchema = paginationSchema.extend({
  status: z.enum(["pending", "under_review", "approved", "rejected", "suspended"]).optional(),
});

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "vendors.view");
  const { page, pageSize, q, status } = parseQuery(req, querySchema);

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { businessName: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: { owner: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.vendor.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
