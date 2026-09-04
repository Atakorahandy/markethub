"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type VendorOrderRow = {
  id: string; status: string; total: number; createdAt: string;
  items: { quantity: number }[];
  order: { orderNumber: string; recipientName: string; city: string; region: string };
};

const TABS = ["paid", "processing", "shipped", "delivered", "cancelled"] as const;

export default function VendorOrdersPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("paid");
  const [items, setItems] = useState<VendorOrderRow[] | null>(null);

  useEffect(() => {
    setItems(null);
    api<{ items: VendorOrderRow[] }>(`/vendor/orders?status=${tab}`).then((r) => setItems(r.items));
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="section-title">Orders</h1>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} orders`} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Total</th><th className="th">Status</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((vo) => (
                <tr key={vo.id}>
                  <td className="td font-medium">{vo.order.orderNumber}</td>
                  <td className="td">{vo.order.recipientName} <span className="muted">· {vo.order.city}</span></td>
                  <td className="td">{vo.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="td">{formatMoney(vo.total)}</td>
                  <td className="td"><StatusBadge status={vo.status} /></td>
                  <td className="td text-right"><Link href={`/vendor/orders/${vo.id}`} className="link text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
