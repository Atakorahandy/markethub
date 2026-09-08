export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ active: z.boolean() });

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const sale = await prisma.flashSale.findUnique({ where: { id } });
  if (!sale || sale.vendorId !== s.vendorIds[0]) throw Errors.notFound();

  const updated = await prisma.flashSale.update({ where: { id }, data: { active: body.active } });

  await audit({ req, actorId: s.userId, actorName: s.name, action: body.active ? "flash_sale.reactivated" : "flash_sale.cancelled", entityType: "flashSale", entityId: id });
  return ok(updated);
});
