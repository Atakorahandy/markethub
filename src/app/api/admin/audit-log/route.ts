export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, parseQuery } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { paginationSchema, paginate } from "@/lib/validation";

export const GET = handler(async (req: Request) => {
  await requirePlatform(req, "audit.view");
  const { page, pageSize, q } = parseQuery(req, paginationSchema);

  const where = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" as const } },
          { actorName: { contains: q, mode: "insensitive" as const } },
          { entityType: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate(page, pageSize) }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
});
