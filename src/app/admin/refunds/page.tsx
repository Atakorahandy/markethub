"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type RefundRow = {
  id: string; amount: number; reason: string; walletReversed: boolean; processedByName: string; createdAt: string;
  vendorOrder: { vendor: { businessName: string }; order: { orderNumber: string } };
};

export default function AdminRefundsPage() {
  const [items, setItems] = useState<RefundRow[] | null>(null);

  useEffect(() => {
    api<{ items: RefundRow[] }>("/admin/refunds?pageSize=50").then((r) => setItems(r.items));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="section-title">Refunds</h1>
      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No refunds issued yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Order</th><th className="th">Vendor</th><th className="th">Amount</th><th className="th">Wallet reversed</th><th className="th">Reason</th><th className="th">By</th><th className="th">Date</th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.vendorOrder.order.orderNumber}</td>
                  <td className="td">{r.vendorOrder.vendor.businessName}</td>
                  <td className="td">{formatMoney(r.amount)}</td>
                  <td className="td">{r.walletReversed ? "Yes" : "No — vendor hadn't been paid yet"}</td>
                  <td className="td max-w-xs truncate" title={r.reason}>{r.reason}</td>
                  <td className="td">{r.processedByName}</td>
                  <td className="td">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
