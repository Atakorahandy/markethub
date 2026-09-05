export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  isActive: z.boolean().optional(),
  // Recovery path for a staff member locked out after losing their
  // authenticator device — only ever clears the target's own MFA, never
  // touches the acting admin's.
  disableMfa: z.literal(true).optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "users.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  if (id === s.userId && body.isActive === false) throw Errors.validation({ isActive: "self_suspend" }, "You cannot suspend your own account.");
  if (body.isActive === undefined && !body.disableMfa) throw Errors.validation({ body: "empty" }, "Nothing to update.");

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.disableMfa ? { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaBackupCodes: "[]" } : {}),
    },
    select: { id: true, name: true, email: true, isActive: true, mfaEnabledAt: true },
  });

  if (body.isActive !== undefined) {
    await audit({ req, actorId: s.userId, actorName: s.name, action: body.isActive ? "user.activated" : "user.suspended", entityType: "user", entityId: user.id });
  }
  if (body.disableMfa) {
    await audit({ req, actorId: s.userId, actorName: s.name, action: "auth.mfa_disabled_by_admin", entityType: "user", entityId: user.id });
  }

  return ok(user);
});
