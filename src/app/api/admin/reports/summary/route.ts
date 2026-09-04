export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const ACTIVE_VENDOR_ORDER_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "reports.view");
  const { from, to } = parseQuery(req, querySchema);
  const rangeStart = from ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const rangeEnd = to ?? new Date();

  const [payments, vendorOrdersInRange, statusBreakdown] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "SUCCESSFUL", paidAt: { gte: rangeStart, lte: rangeEnd } },
      select: { amount: true, paidAt: true, method: true },
    }),
    prisma.vendorOrder.groupBy({
      by: ["vendorId"],
      where: { status: { in: [...ACTIVE_VENDOR_ORDER_STATUSES] }, createdAt: { gte: rangeStart, lte: rangeEnd } },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.vendorOrder.groupBy({
      by: ["status"],
      where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
      _count: { _all: true },
    }),
  ]);

  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const orderCount = payments.length;
  const avgOrderValue = orderCount ? Math.round(revenue / orderCount) : 0;

  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const day = (p.paidAt ?? new Date()).toISOString().slice(0, 10);
    const bucket = dailyMap.get(day) ?? { amount: 0, count: 0 };
    bucket.amount += p.amount;
    bucket.count += 1;
    dailyMap.set(day, bucket);
  }
  const dailyRevenue = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));

  const methodMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const bucket = methodMap.get(p.method) ?? { amount: 0, count: 0 };
    bucket.amount += p.amount;
    bucket.count += 1;
    methodMap.set(p.method, bucket);
  }
  const paymentMethods = [...methodMap.entries()].map(([method, v]) => ({ method, ...v }));

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorOrdersInRange.map((v) => v.vendorId) } },
    select: { id: true, businessName: true },
  });
  const vendorName = new Map(vendors.map((v) => [v.id, v.businessName]));
  const topVendors = vendorOrdersInRange.map((v) => ({
    vendorId: v.vendorId,
    businessName: vendorName.get(v.vendorId) ?? "Unknown vendor",
    revenue: v._sum.total ?? 0,
    orderCount: v._count._all,
  }));

  const orderStatusBreakdown = statusBreakdown.map((s) => ({ status: s.status, count: s._count._all }));

  return ok({
    range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
    revenue,
    orderCount,
    avgOrderValue,
    dailyRevenue,
    paymentMethods,
    topVendors,
    orderStatusBreakdown,
  });
});
