export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { uniqueSlug } from "@/lib/ids";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "settings.manage");
  const items = await prisma.cmsPage.findMany({ orderBy: { updatedAt: "desc" } });
  return ok({ items });
});

const schema = z.object({
  title: z.string().trim().min(2).max(150),
  content: z.string().trim().max(20_000).default(""),
  published: z.boolean().default(false),
});

export const POST = handler(async (req: Request) => {
  const s = await requirePlatform(req, "settings.manage");
  const body = await parseBody(req, schema);

  const slug = await uniqueSlug(body.title, (slug) => prisma.cmsPage.findUnique({ where: { slug } }).then(Boolean));
  const page = await prisma.cmsPage.create({ data: { slug, title: body.title, content: body.content, published: body.published } });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "cms.created", entityType: "cmsPage", entityId: page.id });
  return ok(page, 201);
});
