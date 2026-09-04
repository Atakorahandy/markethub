export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { audit } from "@/lib/audit";

function requireOwnVendor(s: { vendorIds: string[] }) {
  if (s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  return s.vendorIds[0];
}

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage")) throw Errors.forbidden();
  const vendorId = requireOwnVendor(s);

  const items = await prisma.coupon.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" } });
  return ok({ items });
});

const schema = z.object({
  code: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9]+$/, "Letters and numbers only."),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive(),
  minSubtotal: z.coerce.number().min(0).default(0), // cedis
  maxDiscount: z.coerce.number().positive().optional(), // cedis, percent coupons only
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  perCustomerLimit: z.coerce.number().int().positive().optional(),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage")) throw Errors.forbidden();
  const vendorId = requireOwnVendor(s);
  const body = await parseBody(req, schema);

  if (body.type === "percent" && (body.value < 1 || body.value > 100)) {
    throw Errors.validation({ value: "A percentage discount must be between 1 and 100." });
  }
  if (body.endsAt && body.startsAt && body.endsAt <= body.startsAt) {
    throw Errors.validation({ endsAt: "End date must be after the start date." });
  }

  const coupon = await prisma.coupon.create({
    data: {
      vendorId,
      code: body.code.toUpperCase(),
      type: body.type,
      value: body.type === "percent" ? body.value : Math.round(body.value * 100),
      minSubtotal: Math.round(body.minSubtotal * 100),
      maxDiscount: body.maxDiscount != null ? Math.round(body.maxDiscount * 100) : null,
      startsAt: body.startsAt ?? null,
      endsAt: body.endsAt ?? null,
      usageLimit: body.usageLimit ?? null,
      perCustomerLimit: body.perCustomerLimit ?? null,
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "coupon.created", entityType: "coupon", entityId: coupon.id, meta: { code: coupon.code } });
  return ok(coupon, 201);
});
