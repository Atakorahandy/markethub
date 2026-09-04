export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

async function loadOwnProduct(req: Request, id: string) {
  const s = await requireAuth(req);
  if (!can(s, "products.manage_own") || s.vendorIds.length === 0) throw Errors.forbidden();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.vendorId !== s.vendorIds[0]) throw Errors.notFound();
  return { session: s, product };
}

export const GET = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const id = idSchema.parse(params.id);
  const { product } = await loadOwnProduct(req, id);
  return ok(product);
});

const schema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  description: z.string().trim().max(5000).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  price: z.coerce.number().positive().max(1_000_000).optional(), // cedis
  discountPrice: z.coerce.number().positive().max(1_000_000).nullable().optional(), // cedis
  stock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  images: z.array(z.string().url()).max(8).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  status: z.enum(["draft", "pending_review", "active", "rejected", "out_of_stock", "suspended"]).optional(),
  isFeatured: z.boolean().optional(),
});

// A vendor can freely move between these; going live, getting suspended, or
// getting rejected are admin-only calls (Phase 7 moderation gate). Setting
// status back to its own current value is always allowed as a no-op, so the
// edit form can submit unchanged when it's showing an admin-set status.
const VENDOR_SETTABLE_STATUS = new Set(["draft", "pending_review", "out_of_stock"]);

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const id = idSchema.parse(params.id);
  const { session, product } = await loadOwnProduct(req, id);
  const body = await parseBody(req, schema);

  if (body.status !== undefined && body.status !== product.status && !VENDOR_SETTABLE_STATUS.has(body.status)) {
    throw Errors.forbidden(`Only an admin can move a product to "${body.status.replace(/_/g, " ")}".`);
  }

  const price = body.price != null ? Math.round(body.price * 100) : undefined;
  const discountPrice = body.discountPrice !== undefined ? (body.discountPrice != null ? Math.round(body.discountPrice * 100) : null) : undefined;
  const effectivePrice = price ?? product.price;
  if (discountPrice != null && discountPrice >= effectivePrice) {
    throw Errors.validation({ discountPrice: "Discount price must be lower than the regular price." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(discountPrice !== undefined ? { discountPrice } : {}),
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
        ...(body.lowStockThreshold !== undefined ? { lowStockThreshold: body.lowStockThreshold } : {}),
        ...(body.images !== undefined ? { images: JSON.stringify(body.images) } : {}),
        ...(body.tags !== undefined ? { tags: JSON.stringify(body.tags) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
      },
    });
    // Manual stock edits (vs. sale/return, which happen elsewhere) are logged
    // as an adjustment so the inventory ledger stays a complete record.
    if (body.stock !== undefined && body.stock !== product.stock) {
      await tx.inventoryTransaction.create({
        data: { productId: id, type: "adjustment", quantity: body.stock - product.stock, note: "Manual stock edit by vendor" },
      });
    }
    return u;
  });

  await audit({ req, actorId: session.userId, actorName: session.name, action: "product.updated", entityType: "product", entityId: id });
  return ok(updated);
});

export const DELETE = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const id = idSchema.parse(params.id);
  const { session } = await loadOwnProduct(req, id);
  await prisma.product.delete({ where: { id } });
  await audit({ req, actorId: session.userId, actorName: session.name, action: "product.deleted", entityType: "product", entityId: id });
  return ok({ ok: true });
});
