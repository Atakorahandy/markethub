import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/** A delivery agent's balance is ALWAYS the sum of its ledger — same
 *  discipline as src/lib/wallet.ts for vendors. */
export async function agentBalance(tx: Tx, agentId: string): Promise<number> {
  const agg = await tx.deliveryAgentLedgerEntry.aggregate({ where: { agentId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

export async function agentLedgerMove(
  tx: Tx,
  input: { agentId: string; type: string; amount: number; note?: string; deliveryId?: string },
): Promise<{ entryId: string; balanceAfter: number }> {
  const current = await agentBalance(tx, input.agentId);
  const balanceAfter = current + input.amount;
  const entry = await tx.deliveryAgentLedgerEntry.create({
    data: { agentId: input.agentId, type: input.type, amount: input.amount, balanceAfter, note: input.note ?? "", deliveryId: input.deliveryId },
  });
  return { entryId: entry.id, balanceAfter };
}
