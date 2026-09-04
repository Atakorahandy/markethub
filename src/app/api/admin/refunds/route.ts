export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "orders.view");
  const { page, pageSize } = parseQuery(req, paginationSchema);

  const [items, total] = await Promise.all([
    prisma.refund.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vendorOrder: {
          select: { vendor: { select: { businessName: true } }, order: { select: { orderNumber: true } } },
        },
      },
      ...paginate(page, pageSize),
    }),
    prisma.refund.count(),
  ]);

  return ok({ items, total, page, pageSize });
});
