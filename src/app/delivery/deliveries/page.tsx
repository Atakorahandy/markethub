"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type DeliveryRow = {
  id: string; status: string; agentEarning: number;
  vendorOrder: {
    vendor: { businessName: string };
    order: { orderNumber: string; recipientName: string; city: string; region: string };
    items: { quantity: number }[];
  };
};

const TABS = ["assigned", "picked_up", "out_for_delivery", "delivered", "failed"] as const;

export default function MyDeliveriesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("assigned");
  const [items, setItems] = useState<DeliveryRow[] | null>(null);

  useEffect(() => {
    setItems(null);
    api<{ items: DeliveryRow[] }>(`/delivery/deliveries?status=${tab}`).then((r) => setItems(r.items));
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="section-title">My deliveries</h1>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab.replace(/_/g, " ")} deliveries`} /> : (
        <div className="grid gap-3">
          {items.map((d) => (
            <Link key={d.id} href={`/delivery/deliveries/${d.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{d.vendorOrder.order.orderNumber} <StatusBadge status={d.status} /></p>
                <p className="muted text-sm">{d.vendorOrder.vendor.businessName} → {d.vendorOrder.order.recipientName}, {d.vendorOrder.order.city}</p>
                <p className="muted text-xs">{d.vendorOrder.items.reduce((s, i) => s + i.quantity, 0)} item(s) · earns {formatMoney(d.agentEarning)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
