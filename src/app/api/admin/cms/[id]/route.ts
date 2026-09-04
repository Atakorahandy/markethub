export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request, { params }: { params: { id: string } }) => {
  await requirePlatform(req, "settings.manage");
  const id = idSchema.parse(params.id);
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) throw Errors.notFound();
  return ok(page);
});

const schema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  content: z.string().trim().max(20_000).optional(),
  published: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "settings.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const updated = await prisma.cmsPage.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.published !== undefined ? { published: body.published } : {}),
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "cms.updated", entityType: "cmsPage", entityId: id });
  return ok(updated);
});

export const DELETE = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "settings.manage");
  const id = idSchema.parse(params.id);
  await prisma.cmsPage.delete({ where: { id } });
  await audit({ req, actorId: s.userId, actorName: s.name, action: "cms.deleted", entityType: "cmsPage", entityId: id });
  return ok({ ok: true });
});
