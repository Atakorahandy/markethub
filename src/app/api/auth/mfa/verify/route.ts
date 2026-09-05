export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { verifyMfaChallenge } from "@/lib/jwt";
import { issueSession, setSessionCookies } from "@/lib/auth";
import { verifyMfaCode } from "@/lib/mfa";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const schema = z.object({ challengeToken: z.string().min(10), code: z.string().trim().min(6).max(11) });

/** The second half of a login for an MFA-enabled account. The challenge
 *  token (5-minute TTL, see src/lib/jwt.ts) already proves the password
 *  step succeeded — this only ever needs to check the second factor before
 *  issuing the real session, exactly like /api/auth/login would have. */
export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`mfa-verify:${ip}`, 20, 300);
  const body = await parseBody(req, schema);

  let claims;
  try {
    claims = await verifyMfaChallenge(body.challengeToken);
  } catch {
    throw Errors.unauthorized("This code entry has expired. Please sign in again.");
  }
  rateLimit(`mfa-verify:${claims.sub}`, 10, 300);

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.isActive || !user.mfaSecret) throw Errors.unauthorized("This code entry has expired. Please sign in again.");

  const check = verifyMfaCode({ secret: user.mfaSecret, backupCodesJson: user.mfaBackupCodes, code: body.code });
  if (!check.ok) {
    await audit({ req, actorId: user.id, action: "auth.mfa_failed", entityType: "user", entityId: user.id });
    throw Errors.validation({ code: "invalid" }, "That code is incorrect.");
  }
  if (check.usedBackupCode) {
    await prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodes: check.remainingBackupCodesJson } });
  }

  const tokens = await issueSession(user, { userAgent: req.headers.get("user-agent") ?? "", ip });
  await audit({ req, actorId: user.id, actorName: user.name, action: check.usedBackupCode ? "auth.mfa_verified_backup_code" : "auth.mfa_verified", entityType: "user", entityId: user.id });

  const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: { select: { key: true, scope: true } } } });

  const res = ok({
    user: { id: user.id, name: user.name, email: user.email, kind: user.kind },
    roles: roles.map((r) => ({ key: r.role.key, scope: r.role.scope, vendorId: r.vendorId })),
    tokens,
    usedBackupCode: check.usedBackupCode,
  });
  setSessionCookies(res, tokens);
  return res;
});
