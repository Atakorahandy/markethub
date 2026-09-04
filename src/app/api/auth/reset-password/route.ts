export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { passwordSchema } from "@/lib/validation";
import { hashPassword, sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, schema);
  const tokenHash = sha256(body.token);

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw Errors.validation({ token: "This reset link is invalid or has expired." });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(body.password), failedLogins: 0, lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await audit({ req, actorId: reset.userId, action: "auth.password_reset", entityType: "user", entityId: reset.userId });
  return ok({ ok: true });
});
