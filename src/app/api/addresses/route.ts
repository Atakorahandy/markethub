export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import { GHANA_REGIONS } from "@/lib/constants";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const items = await prisma.address.findMany({ where: { userId: s.userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return ok({ items });
});

const schema = z.object({
  label: z.enum(["home", "office", "other"]).default("home"),
  recipientName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  region: z.enum(GHANA_REGIONS),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80).optional(),
  streetLine: z.string().trim().max(200).optional(),
  gpsAddress: z.string().trim().max(50).optional(),
  deliveryInstructions: z.string().trim().max(300).optional(),
  isDefault: z.boolean().default(false),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "profile.manage")) throw Errors.forbidden();
  const body = await parseBody(req, schema);

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.address.updateMany({ where: { userId: s.userId }, data: { isDefault: false } });
    const count = await tx.address.count({ where: { userId: s.userId } });
    return tx.address.create({
      data: { ...body, userId: s.userId, isDefault: body.isDefault || count === 0 },
    });
  });

  return ok(address, 201);
});
