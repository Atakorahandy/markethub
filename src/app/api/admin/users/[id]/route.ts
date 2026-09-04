export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({ isActive: z.boolean() });

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requirePlatform(req, "users.manage");
  const id = idSchema.parse(params.id);
  const body = await parseBody(req, schema);

  if (id === s.userId && !body.isActive) throw Errors.validation({ isActive: "You cannot suspend your own account." });

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: body.isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });

  await audit({
    req,
    actorId: s.userId,
    actorName: s.name,
    action: body.isActive ? "user.activated" : "user.suspended",
    entityType: "user",
    entityId: user.id,
  });

  return ok(user);
});
