export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginate } from "@/lib/validation";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "orders.view");
  const { page, pageSize, status, q } = parseQuery(req, querySchema);

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { order: { orderNumber: { contains: q, mode: "insensitive" as const } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendorOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: { select: { businessName: true, slug: true } },
        order: { select: { orderNumber: true, recipientName: true, createdAt: true } },
        items: { select: { id: true } },
        refunds: { select: { id: true } },
      },
      ...paginate(page, pageSize),
    }),
    prisma.vendorOrder.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
