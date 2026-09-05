export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { verifyMfaCode } from "@/lib/mfa";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const schema = z.object({ password: z.string().min(1), code: z.string().trim().min(6).max(11) });

/** Turning MFA off requires both the account password AND a currently-valid
 *  second factor — a stolen session cookie alone can't disable protection
 *  it doesn't already satisfy. */
export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  rateLimit(`mfa-disable:${s.userId}`, 10, 300);
  const body = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user?.mfaSecret) throw Errors.conflict("Two-factor authentication isn't enabled.");

  const validPassword = await verifyPassword(body.password, user.passwordHash);
  if (!validPassword) throw Errors.validation({ password: "incorrect" }, "That password is incorrect.");

  const check = verifyMfaCode({ secret: user.mfaSecret, backupCodesJson: user.mfaBackupCodes, code: body.code });
  if (!check.ok) throw Errors.validation({ code: "invalid" }, "That code is incorrect.");

  await prisma.user.update({
    where: { id: s.userId },
    data: { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaBackupCodes: "[]" },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "auth.mfa_disabled", entityType: "user", entityId: s.userId });
  return ok({ ok: true });
});
