export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true, kind: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true },
  });
  return ok({
    user,
    roleKeys: s.roleKeys,
    permissions: [...s.permissions],
    vendorIds: s.vendorIds,
    deliveryAgentId: s.deliveryAgentId,
    isSuperAdmin: s.isSuperAdmin,
    isPlatformStaff: s.isPlatformStaff,
  });
});
