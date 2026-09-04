export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { walletBalance, walletMove } from "@/lib/wallet";
import { audit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "withdrawals.create") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const items = await prisma.withdrawal.findMany({ where: { vendorId: s.vendorIds[0] }, orderBy: { requestedAt: "desc" } });
  return ok({ items });
});

const schema = z.object({ amount: z.coerce.number().positive().max(1_000_000) }); // cedis

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "withdrawals.create") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const vendorId = s.vendorIds[0];
  const body = await parseBody(req, schema);
  const amount = Math.round(body.amount * 100); // pesewas

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw Errors.notFound();
  if (!vendor.payoutBank.trim() || !vendor.payoutAccount.trim()) {
    throw Errors.validation({ payoutBank: "required" }, "Add your payout bank/mobile money details in Store settings before requesting a withdrawal.");
  }

  const withdrawal = await prisma.$transaction(async (tx) => {
    const balance = await walletBalance(tx, vendorId);
    if (amount > balance) throw Errors.validation({ amount: "exceeds balance" }, "That's more than your available wallet balance.");

    const w = await tx.withdrawal.create({
      data: { vendorId, amount, payoutBank: vendor.payoutBank, payoutAccount: vendor.payoutAccount, status: "pending" },
    });
    await walletMove(tx, { vendorId, type: "withdrawal", amount: -amount, note: `Withdrawal request ${w.id}`, withdrawalId: w.id });
    return w;
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "withdrawal.requested", entityType: "withdrawal", entityId: withdrawal.id, meta: { vendorId, amount } });
  return ok(withdrawal, 201);
});
