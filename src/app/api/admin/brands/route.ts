export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { uniqueSlug } from "@/lib/ids";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "categories.manage");
  const items = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  return ok({ items });
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const POST = handler(async (req: Request) => {
  const s = await requirePlatform(req, "categories.manage");
  const body = await parseBody(req, schema);
  const slug = await uniqueSlug(body.name, (slug) => prisma.brand.findUnique({ where: { slug } }).then(Boolean));

  const brand = await prisma.brand.create({ data: { name: body.name, slug, logoUrl: body.logoUrl || null } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "brand.created", entityType: "brand", entityId: brand.id });
  return ok(brand, 201);
});
