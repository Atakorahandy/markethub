export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  parentId: z.string().cuid().nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "categories.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  if (body.parentId === id) throw Errors.validation({ parentId: "self_reference" }, "A category cannot be its own parent.");

  const category = await prisma.category.update({ where: { id }, data: body });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "category.updated", entityType: "category", entityId: id });
  return ok(category);
});

export const DELETE = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "categories.manage");
  const id = idSchema.parse(params.id);

  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);
  if (childCount > 0) throw Errors.conflict("Remove or reassign its subcategories first.");
  if (productCount > 0) throw Errors.conflict("Reassign its products to another category first.");

  await prisma.category.delete({ where: { id } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "category.deleted", entityType: "category", entityId: id });
  return ok({ ok: true });
});
