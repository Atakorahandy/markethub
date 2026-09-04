export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { audit } from "@/lib/audit";

function requireOwnVendor(s: { vendorIds: string[] }) {
  if (s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  return s.vendorIds[0];
}

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage")) throw Errors.forbidden();
  const vendorId = requireOwnVendor(s);

  const items = await prisma.flashSale.findMany({
    where: { vendorId },
    orderBy: { startsAt: "desc" },
    include: { product: { select: { name: true, slug: true, price: true, discountPrice: true } } },
  });
  return ok({ items });
});

const schema = z
  .object({
    productId: z.string().cuid(),
    salePrice: z.coerce.number().positive().max(1_000_000), // cedis
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End time must be after the start time.", path: ["endsAt"] });

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "promotions.manage")) throw Errors.forbidden();
  const vendorId = requireOwnVendor(s);
  const body = await parseBody(req, schema);

  const product = await prisma.product.findUnique({ where: { id: body.productId } });
  if (!product || product.vendorId !== vendorId) throw Errors.validation({ productId: "Select one of your own products." });

  const salePrice = Math.round(body.salePrice * 100);
  const normalPrice = product.discountPrice ?? product.price;
  if (salePrice >= normalPrice) throw Errors.validation({ salePrice: "The flash sale price must be lower than the current price." });

  const sale = await prisma.flashSale.create({
    data: { vendorId, productId: product.id, salePrice, startsAt: body.startsAt, endsAt: body.endsAt },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "flash_sale.created", entityType: "flashSale", entityId: sale.id, meta: { productId: product.id } });
  return ok(sale, 201);
});
