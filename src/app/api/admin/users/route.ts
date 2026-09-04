export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "users.view");
  const { page, pageSize, q } = parseQuery(req, paginationSchema);

  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, kind: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
