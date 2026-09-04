import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/** A vendor's wallet balance is ALWAYS the sum of its ledger — never read
 *  from a mutable running total. Cheap enough at this scale; an indexed
 *  materialized balance can be added later without changing callers. */
export async function walletBalance(tx: Tx, vendorId: string): Promise<number> {
  const agg = await tx.walletLedgerEntry.aggregate({ where: { vendorId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

/** Append one ledger entry and return the new balance. Must be called inside
 *  a `prisma.$transaction` alongside whatever it's paired with (order status
 *  change, withdrawal request) so the ledger and the thing it represents
 *  never drift apart. */
export async function walletMove(
  tx: Tx,
  input: { vendorId: string; type: string; amount: number; note?: string; vendorOrderId?: string; withdrawalId?: string },
): Promise<{ entryId: string; balanceAfter: number }> {
  const current = await walletBalance(tx, input.vendorId);
  const balanceAfter = current + input.amount;
  const entry = await tx.walletLedgerEntry.create({
    data: {
      vendorId: input.vendorId,
      type: input.type,
      amount: input.amount,
      balanceAfter,
      note: input.note ?? "",
      vendorOrderId: input.vendorOrderId,
      withdrawalId: input.withdrawalId,
    },
  });
  return { entryId: entry.id, balanceAfter };
}
