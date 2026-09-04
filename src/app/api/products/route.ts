export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { paginate } from "@/lib/validation";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(), // category slug
  brand: z.string().trim().max(80).optional(), // brand slug
  vendor: z.string().trim().max(80).optional(), // vendor slug
  minPrice: z.coerce.number().int().min(0).optional(), // cedis
  maxPrice: z.coerce.number().int().min(0).optional(), // cedis
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc", "trending"]).default("relevance"),
});

export const GET = handler(async (req: Request) => {
  const query = parseQuery(req, querySchema);

  const [category, brand, vendor] = await Promise.all([
    query.category ? prisma.category.findUnique({ where: { slug: query.category } }) : null,
    query.brand ? prisma.brand.findUnique({ where: { slug: query.brand } }) : null,
    query.vendor ? prisma.vendor.findUnique({ where: { slug: query.vendor } }) : null,
  ]);

  const where = {
    status: "active" as const,
    vendor: { status: "approved" as const },
    ...(category ? { categoryId: category.id } : {}),
    ...(brand ? { brandId: brand.id } : {}),
    ...(vendor ? { vendorId: vendor.id } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? { price: { ...(query.minPrice !== undefined ? { gte: query.minPrice * 100 } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice * 100 } : {}) } }
      : {}),
  };

  const orderBy =
    query.sort === "newest" ? { createdAt: "desc" as const }
    : query.sort === "price_asc" ? { price: "asc" as const }
    : query.sort === "price_desc" ? { price: "desc" as const }
    : query.sort === "trending" ? { viewCount: "desc" as const }
    : [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }];

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      select: {
        id: true, slug: true, name: true, price: true, discountPrice: true, images: true,
        ratingAvg: true, ratingCount: true, isFeatured: true, stock: true,
        vendor: { select: { businessName: true, slug: true } },
        category: { select: { name: true, slug: true } },
      },
      ...paginate(query.page, query.pageSize),
    }),
    prisma.product.count({ where }),
  ]);

  return ok({ items, total, page: query.page, pageSize: query.pageSize });
});
