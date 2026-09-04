export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const DELETE = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAuth(req);
  if (!can(s, "cart.manage")) throw Errors.forbidden();
  const id = idSchema.parse(params.id);

  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item || item.userId !== s.userId) throw Errors.notFound();

  await prisma.wishlistItem.delete({ where: { id } });
  return ok({ ok: true });
});
