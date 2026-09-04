import type { Prisma } from "@prisma/client";
import { DEFAULT_COMMISSION_BPS } from "./constants";
import { applyBps } from "./money";
import { walletMove } from "./wallet";
import { deliveryOtp } from "./ids";

type Tx = Prisma.TransactionClient;
type VendorOrderWithVendor = { id: string; vendorId: string; subtotal: number; deliveryFee: number; walletCreditedAt: Date | null; vendor: { commissionBps: number | null } };

/** Credits a vendor's wallet for a delivered order — a gross "sale" entry
 *  plus a "commission" debit, so the platform's cut stays auditable. Callers
 *  from both the vendor's own "mark delivered" action (Phase 5) and the
 *  delivery agent's OTP confirmation (Phase 6) go through here, guarded by
 *  `walletCreditedAt` so whichever path gets there first is the only one
 *  that pays out — never both. */
export async function creditVendorForDelivery(tx: Tx, vendorOrder: VendorOrderWithVendor): Promise<void> {
  if (vendorOrder.walletCreditedAt) return;

  const commissionBps = vendorOrder.vendor.commissionBps ?? DEFAULT_COMMISSION_BPS;
  const gross = vendorOrder.subtotal + vendorOrder.deliveryFee;
  const commission = applyBps(vendorOrder.subtotal, commissionBps);

  await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "sale", amount: gross, note: `Order ${vendorOrder.id}`, vendorOrderId: vendorOrder.id });
  await walletMove(tx, { vendorId: vendorOrder.vendorId, type: "commission", amount: -commission, note: `Platform commission (${commissionBps / 100}%)`, vendorOrderId: vendorOrder.id });
  await tx.vendorOrder.update({ where: { id: vendorOrder.id }, data: { walletCreditedAt: new Date() } });
}

/** Opens a delivery job for a freshly-shipped VendorOrder, if one doesn't
 *  already exist (a vendor could theoretically retry the shipped action). */
export async function ensureDeliveryJob(tx: Tx, vendorOrderId: string, deliveryFee: number): Promise<void> {
  const existing = await tx.delivery.findUnique({ where: { vendorOrderId } });
  if (existing) return;
  await tx.delivery.create({
    data: { vendorOrderId, otpCode: deliveryOtp(), agentEarning: deliveryFee, status: "pending_assignment" },
  });
}
