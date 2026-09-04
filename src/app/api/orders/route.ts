export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const { page, pageSize } = parseQuery(req, paginationSchema);

  const where = { customerId: s.userId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { vendorOrders: { include: { items: true } } },
      ...paginate(page, pageSize),
    }),
    prisma.order.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
