export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { loadCartSummary } from "@/lib/cart";

async function loadOwn(req: Request, id: string) {
  const s = await requireAuth(req);
  if (!can(s, "cart.manage")) throw Errors.forbidden();
  const item = await prisma.cartItem.findUnique({ where: { id } });
  if (!item || item.userId !== s.userId) throw Errors.notFound();
  return { session: s, item };
}

const schema = z.object({ quantity: z.coerce.number().int().min(1).max(99) });

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await params).id);
  const { session } = await loadOwn(req, id);
  const body = await parseBody(req, schema);
  await prisma.cartItem.update({ where: { id }, data: { quantity: body.quantity } });
  return ok(await loadCartSummary(session.userId));
});

export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await params).id);
  const { session } = await loadOwn(req, id);
  await prisma.cartItem.delete({ where: { id } });
  return ok(await loadCartSummary(session.userId));
});
