export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors, ApiError } from "@/lib/api";
import { verifyPassword } from "@/lib/crypto";
import { emailSchema } from "@/lib/validation";
import { issueSession, setSessionCookies } from "@/lib/auth";
import { signMfaChallenge } from "@/lib/jwt";
import { audit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { env } from "@/lib/env";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`login:${ip}`, 20, 300);
  const body = await parseBody(req, schema);
  rateLimit(`login:${body.email}`, env.loginMaxAttempts * 3, 900);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const genericFail = Errors.unauthorized("Email or password is incorrect.");
  if (!user || !user.isActive) throw genericFail;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError("account_locked", "Too many failed attempts. Try again shortly.", 423);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= env.loginMaxAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + env.loginLockoutMinutes * 60_000) : null,
      },
    });
    await audit({ req, actorId: user.id, action: "auth.login_failed", entityType: "user", entityId: user.id });
    throw genericFail;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  // Password is correct, but a session isn't issued yet — the client must
  // still prove possession of the second factor via /api/auth/mfa/verify.
  if (user.mfaEnabledAt) {
    const challengeToken = await signMfaChallenge(user.id);
    return ok({ mfaRequired: true, challengeToken });
  }

  const tokens = await issueSession(user, { userAgent: req.headers.get("user-agent") ?? "", ip });
  await audit({ req, actorId: user.id, actorName: user.name, action: "auth.login", entityType: "user", entityId: user.id });

  const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: { select: { key: true, scope: true } } } });

  const res = ok({
    user: { id: user.id, name: user.name, email: user.email, kind: user.kind },
    roles: roles.map((r) => ({ key: r.role.key, scope: r.role.scope, vendorId: r.vendorId })),
    tokens,
  });
  setSessionCookies(res, tokens);
  return res;
});
