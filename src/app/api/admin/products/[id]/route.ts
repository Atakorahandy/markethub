export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["pending_review", "active", "rejected", "suspended"]).optional(),
  moderationNote: z.string().trim().max(300).optional(),
  isFeatured: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requirePlatform(req, "products.manage");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Errors.notFound();

  if (body.status === "rejected" || body.status === "suspended") {
    if (!body.moderationNote) throw Errors.validation({ moderationNote: "required" }, "Add a note explaining why, so the vendor knows what to fix.");
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.moderationNote !== undefined ? { moderationNote: body.moderationNote } : {}),
      ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: `product.${body.status ?? "updated"}`, entityType: "product", entityId: id, meta: { vendorId: product.vendorId } });
  return ok(updated);
});
