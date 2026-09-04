export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, parseQuery, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";
import { uniqueSlug } from "@/lib/ids";
import { audit } from "@/lib/audit";

async function requireOwnVendor(req: Request) {
  const s = await requireAuth(req);
  if (!can(s, "products.manage_own") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const vendor = await prisma.vendor.findUnique({ where: { id: s.vendorIds[0] } });
  if (!vendor) throw Errors.notFound();
  if (vendor.status !== "approved") throw Errors.forbidden("Your store must be approved before you can manage products.");
  return { session: s, vendor };
}

export const GET = handler(async (req: Request) => {
  const { vendor } = await requireOwnVendor(req);
  const { page, pageSize, q } = parseQuery(req, paginationSchema);

  const where = { vendorId: vendor.id, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
      ...paginate(page, pageSize),
    }),
    prisma.product.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
});

const schema = z.object({
  name: z.string().trim().min(3).max(150),
  categoryId: z.string().cuid(),
  brandId: z.string().cuid().nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  description: z.string().trim().max(5000).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  price: z.coerce.number().positive().max(1_000_000), // cedis
  discountPrice: z.coerce.number().positive().max(1_000_000).nullable().optional(), // cedis
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  images: z.array(z.string().url()).max(8).default([]),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  // A vendor can only stage a product as draft or submit it for review —
  // going live ("active") requires admin approval (Phase 7 moderation gate).
  status: z.enum(["draft", "pending_review"]).default("pending_review"),
});

export const POST = handler(async (req: Request) => {
  const { session, vendor } = await requireOwnVendor(req);
  const body = await parseBody(req, schema);

  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) throw Errors.validation({ categoryId: "Select a valid category." });

  if (body.discountPrice != null && body.discountPrice >= body.price) {
    throw Errors.validation({ discountPrice: "Discount price must be lower than the regular price." });
  }

  const slug = await uniqueSlug(body.name, (slug) => prisma.product.findUnique({ where: { slug } }).then(Boolean));

  const product = await prisma.product.create({
    data: {
      slug,
      vendorId: vendor.id,
      categoryId: body.categoryId,
      brandId: body.brandId || null,
      name: body.name,
      sku: body.sku ?? "",
      description: body.description ?? "",
      shortDescription: body.shortDescription ?? "",
      price: Math.round(body.price * 100),
      discountPrice: body.discountPrice != null ? Math.round(body.discountPrice * 100) : null,
      stock: body.stock,
      lowStockThreshold: body.lowStockThreshold,
      images: JSON.stringify(body.images),
      tags: JSON.stringify(body.tags),
      status: body.status,
    },
  });

  await audit({ req, actorId: session.userId, actorName: session.name, action: "product.created", entityType: "product", entityId: product.id, meta: { vendorId: vendor.id } });
  return ok(product, 201);
});
