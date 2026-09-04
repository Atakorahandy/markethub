export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ active: z.boolean() });

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || coupon.vendorId !== s.vendorIds[0]) throw Errors.notFound();

  const updated = await prisma.coupon.update({ where: { id }, data: { active: body.active } });

  await audit({ req, actorId: s.userId, actorName: s.name, action: body.active ? "coupon.reactivated" : "coupon.deactivated", entityType: "coupon", entityId: id });
  return ok(updated);
});
