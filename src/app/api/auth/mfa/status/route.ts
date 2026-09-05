export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { mfaEnabledAt: true } });
  return ok({ enabled: !!user?.mfaEnabledAt });
});
