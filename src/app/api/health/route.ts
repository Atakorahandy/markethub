export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "healthy", database: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    return fail(err);
  }
}
