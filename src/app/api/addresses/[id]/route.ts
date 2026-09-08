export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema, phoneSchema } from "@/lib/validation";
import { GHANA_REGIONS } from "@/lib/constants";

async function loadOwn(req: Request, id: string) {
  const s = await requireAuth(req);
  if (!can(s, "profile.manage")) throw Errors.forbidden();
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== s.userId) throw Errors.notFound();
  return { session: s, address };
}

const schema = z.object({
  label: z.enum(["home", "office", "other"]).optional(),
  recipientName: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.optional(),
  region: z.enum(GHANA_REGIONS).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  area: z.string().trim().max(80).optional(),
  streetLine: z.string().trim().max(200).optional(),
  gpsAddress: z.string().trim().max(50).optional(),
  deliveryInstructions: z.string().trim().max(300).optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await params).id);
  const { session } = await loadOwn(req, id);
  const body = await parseBody(req, schema);

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.address.updateMany({ where: { userId: session.userId }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: body });
  });

  return ok(address);
});

export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await params).id);
  await loadOwn(req, id);
  const inUse = await prisma.order.count({ where: { addressId: id } });
  if (inUse > 0) throw Errors.conflict("This address is used on a past order and can't be deleted.");
  await prisma.address.delete({ where: { id } });
  return ok({ ok: true });
});
