export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { recomputeProductRating, recomputeVendorRating } from "@/lib/reviews";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["published", "hidden"]) });

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "reviews.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw Errors.notFound();

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.review.update({ where: { id }, data: { status: body.status } });
    await recomputeProductRating(tx, review.productId);
    await recomputeVendorRating(tx, review.vendorId);
    return u;
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: `review.${body.status}`, entityType: "review", entityId: id });
  return ok(updated);
});
