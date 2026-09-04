export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { uniqueSlug } from "@/lib/ids";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "categories.manage");
  const items = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return ok({ items });
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: z.string().cuid().nullable().optional(),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
});

export const POST = handler(async (req: Request) => {
  const s = await requirePlatform(req, "categories.manage");
  const body = await parseBody(req, schema);
  const slug = await uniqueSlug(body.name, (slug) => prisma.category.findUnique({ where: { slug } }).then(Boolean));

  const category = await prisma.category.create({
    data: { name: body.name, slug, parentId: body.parentId || null, imageUrl: body.imageUrl || null, sortOrder: body.sortOrder },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "category.created", entityType: "category", entityId: category.id });
  return ok(category, 201);
});
