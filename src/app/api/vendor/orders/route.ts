export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { paginate } from "@/lib/validation";

async function requireOwnVendor(req: Request) {
  const s = await requireAuth(req);
  if (!can(s, "orders.manage_own") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  return { session: s, vendorId: s.vendorIds[0] };
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"]).optional(),
});

export const GET = handler(async (req: Request) => {
  const { vendorId } = await requireOwnVendor(req);
  const { page, pageSize, status } = parseQuery(req, querySchema);

  const where = { vendorId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.vendorOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        order: { select: { orderNumber: true, recipientName: true, phone: true, city: true, region: true, createdAt: true } },
      },
      ...paginate(page, pageSize),
    }),
    prisma.vendorOrder.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
