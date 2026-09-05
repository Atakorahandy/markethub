export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const schema = z.object({ code: z.string().trim().length(6) });

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  rateLimit(`mfa-confirm:${s.userId}`, 10, 300);
  const body = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { mfaPendingSecret: true } });
  if (!user?.mfaPendingSecret) throw Errors.conflict("Start enrollment first.");
  if (!verifyTotp(user.mfaPendingSecret, body.code)) throw Errors.validation({ code: "invalid" }, "That code doesn't match. Check your authenticator app and try again.");

  const backupCodes = generateBackupCodes();
  await prisma.user.update({
    where: { id: s.userId },
    data: {
      mfaSecret: user.mfaPendingSecret,
      mfaPendingSecret: null,
      mfaEnabledAt: new Date(),
      mfaBackupCodes: JSON.stringify(backupCodes.map(hashBackupCode)),
    },
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "auth.mfa_enabled", entityType: "user", entityId: s.userId });
  return ok({ backupCodes });
});
