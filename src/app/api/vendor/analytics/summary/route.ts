export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";

const querySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

const ACTIVE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "reports.view") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const vendorId = s.vendorIds[0];
  const { from, to } = parseQuery(req, querySchema);
  const rangeStart = from ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const rangeEnd = to ?? new Date();

  const [vendorOrdersInRange, statusBreakdown, topProducts] = await Promise.all([
    prisma.vendorOrder.findMany({
      where: { vendorId, status: { in: [...ACTIVE_STATUSES] }, createdAt: { gte: rangeStart, lte: rangeEnd } },
      select: { total: true, createdAt: true },
    }),
    prisma.vendorOrder.groupBy({
      by: ["status"],
      where: { vendorId, createdAt: { gte: rangeStart, lte: rangeEnd } },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { vendorOrder: { vendorId, status: { in: [...ACTIVE_STATUSES] }, createdAt: { gte: rangeStart, lte: rangeEnd } } },
      _sum: { quantity: true, priceSnapshot: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const revenue = vendorOrdersInRange.reduce((sum, v) => sum + v.total, 0);
  const orderCount = vendorOrdersInRange.length;
  const avgOrderValue = orderCount ? Math.round(revenue / orderCount) : 0;

  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const v of vendorOrdersInRange) {
    const day = v.createdAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(day) ?? { amount: 0, count: 0 };
    bucket.amount += v.total;
    bucket.count += 1;
    dailyMap.set(day, bucket);
  }
  const dailyRevenue = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));

  const productIds = topProducts.map((p) => p.productId);
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [];
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const topProductRows = topProducts.map((p) => ({
    productId: p.productId,
    name: productName.get(p.productId) ?? "Unknown product",
    quantity: p._sum.quantity ?? 0,
  }));

  const orderStatusBreakdown = statusBreakdown.map((r) => ({ status: r.status, count: r._count._all }));

  return ok({
    range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
    revenue,
    orderCount,
    avgOrderValue,
    dailyRevenue,
    topProducts: topProductRows,
    orderStatusBreakdown,
  });
});
