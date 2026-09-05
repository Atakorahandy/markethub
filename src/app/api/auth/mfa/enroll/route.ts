export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { generateTotpSecret, otpauthUri } from "@/lib/totp";
import { rateLimit } from "@/lib/ratelimit";

/** Two-factor auth is offered to staff accounts only (super_admin,
 *  platform_admin, support_agent, finance_officer) — they're the highest-
 *  value targets in the system (able to approve vendors, refund orders,
 *  moderate anything). Starting enrollment just generates and stores a
 *  pending secret; it isn't "on" until /confirm proves the user can
 *  actually produce a code from it. */
export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!s.isSuperAdmin && !s.isPlatformStaff) throw Errors.forbidden("Two-factor authentication is available to staff accounts only.");
  rateLimit(`mfa-enroll:${s.userId}`, 10, 3600);

  const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { mfaEnabledAt: true, email: true } });
  if (!user) throw Errors.notFound();
  if (user.mfaEnabledAt) throw Errors.conflict("Two-factor authentication is already enabled. Disable it first to re-enroll.");

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: s.userId }, data: { mfaPendingSecret: secret } });

  return ok({ secret, otpauthUri: otpauthUri(secret, user.email) });
});
