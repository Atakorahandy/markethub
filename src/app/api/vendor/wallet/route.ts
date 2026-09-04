export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { walletBalance } from "@/lib/wallet";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "wallet.view") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");
  const vendorId = s.vendorIds[0];

  const [balance, ledger] = await Promise.all([
    walletBalance(prisma, vendorId),
    prisma.walletLedgerEntry.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return ok({ balance, ledger });
});
