export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

export async function GET() {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, logoUrl: true } });
  return ok({ items: brands });
}
