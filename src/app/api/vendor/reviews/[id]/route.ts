export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ vendorReply: z.string().trim().min(1).max(1000) });

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAuth(req);
  if (!can(s, "reviews.manage") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review || review.vendorId !== s.vendorIds[0]) throw Errors.notFound();

  const updated = await prisma.review.update({ where: { id }, data: { vendorReply: body.vendorReply, vendorRepliedAt: new Date() } });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "review.replied", entityType: "review", entityId: id });
  return ok(updated);
});
