export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ commissionBps: z.coerce.number().int().min(0).max(5000).nullable() }); // null = platform default, cap 50%

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requirePlatform(req, "vendors.manage");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const vendor = await prisma.vendor.update({ where: { id }, data: { commissionBps: body.commissionBps } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "vendor.commission_updated", entityType: "vendor", entityId: id, meta: { commissionBps: body.commissionBps } });
  return ok(vendor);
});
