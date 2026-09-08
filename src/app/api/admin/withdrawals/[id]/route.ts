export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { walletMove } from "@/lib/wallet";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["approved", "rejected", "completed"]),
  reviewNote: z.string().trim().max(300).optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requirePlatform(req, "withdrawals.manage");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) throw Errors.notFound();

  const validTransitions: Record<string, string[]> = {
    pending: ["approved", "rejected"],
    approved: ["completed", "rejected"],
  };
  if (!validTransitions[withdrawal.status]?.includes(body.status)) {
    throw Errors.conflict(`Cannot move a "${withdrawal.status}" withdrawal to "${body.status}".`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id },
      data: { status: body.status, reviewNote: body.reviewNote ?? "", processedById: s.userId, processedAt: new Date() },
    });
    // Rejecting returns the held funds to the vendor's wallet.
    if (body.status === "rejected") {
      await walletMove(tx, { vendorId: withdrawal.vendorId, type: "withdrawal_reversal", amount: withdrawal.amount, note: `Withdrawal ${id} rejected`, withdrawalId: id });
    }
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: `withdrawal.${body.status}`, entityType: "withdrawal", entityId: id, meta: { vendorId: withdrawal.vendorId, amount: withdrawal.amount } });
  return ok({ ok: true });
});
