export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, imageUrl: true, parentId: true },
  });
  return ok({ items: categories });
}
