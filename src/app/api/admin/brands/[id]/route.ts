export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "categories.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);
  const brand = await prisma.brand.update({ where: { id }, data: body });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "brand.updated", entityType: "brand", entityId: id });
  return ok(brand);
});

export const DELETE = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "categories.manage");
  const id = idSchema.parse(params.id);
  const productCount = await prisma.product.count({ where: { brandId: id } });
  if (productCount > 0) throw Errors.conflict("Reassign its products to another brand first.");
  await prisma.brand.delete({ where: { id } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "brand.deleted", entityType: "brand", entityId: id });
  return ok({ ok: true });
});
