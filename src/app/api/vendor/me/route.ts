export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (s.vendorIds.length === 0) throw Errors.forbidden("No vendor store linked to this account.");

  const vendor = await prisma.vendor.findUnique({
    where: { id: s.vendorIds[0] },
    select: { id: true, businessName: true, slug: true, status: true, rejectionNote: true, city: true, region: true, createdAt: true },
  });
  if (!vendor) throw Errors.notFound();
  return ok(vendor);
});
