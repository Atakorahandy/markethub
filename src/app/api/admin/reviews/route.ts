export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

const querySchema = paginationSchema.extend({ status: z.enum(["published", "hidden"]).optional() });

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "reviews.manage");
  const { page, pageSize, status } = parseQuery(req, querySchema);

  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, slug: true } },
        vendor: { select: { businessName: true } },
        customer: { select: { name: true } },
      },
      ...paginate(page, pageSize),
    }),
    prisma.review.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
