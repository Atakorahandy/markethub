export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { audit } from "@/lib/audit";

const SELECT = {
  id: true, businessName: true, slug: true, status: true, rejectionNote: true,
  description: true, logoUrl: true, bannerUrl: true, city: true, region: true, createdAt: true,
  payoutBank: true, payoutAccount: true, commissionBps: true,
};

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (s.vendorIds.length === 0) throw Errors.forbidden("No vendor store linked to this account.");

  const vendor = await prisma.vendor.findUnique({ where: { id: s.vendorIds[0] }, select: SELECT });
  if (!vendor) throw Errors.notFound();
  return ok(vendor);
});

const schema = z.object({
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  bannerUrl: z.string().url().max(500).nullable().optional(),
  payoutBank: z.string().trim().max(120).optional(),
  payoutAccount: z.string().trim().max(60).optional(),
});

export const PATCH = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "store.manage") || s.vendorIds.length === 0) throw Errors.forbidden();

  const body = await parseBody(req, schema);
  const vendor = await prisma.vendor.update({ where: { id: s.vendorIds[0] }, data: body, select: SELECT });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "vendor.store_updated", entityType: "vendor", entityId: vendor.id });
  return ok(vendor);
});
