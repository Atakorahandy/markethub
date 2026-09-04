"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type VendorOrderRow = {
  id: string; status: string; total: number; createdAt: string;
  vendor: { businessName: string };
  order: { orderNumber: string; recipientName: string; createdAt: string };
  items: { id: string }[];
  refunds: { id: string }[];
};

const TABS = ["paid", "processing", "shipped", "delivered", "refunded", "cancelled"] as const;
const REFUNDABLE = new Set(["paid", "processing", "shipped", "delivered"]);

export default function AdminOrdersPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("paid");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<VendorOrderRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: VendorOrderRow[] }>(`/admin/orders?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&pageSize=50`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refund(id: string) {
    const reason = window.prompt("Reason for this refund (visible in the audit trail):");
    if (!reason) return;
    try {
      await api(`/admin/orders/${id}/refund`, { method: "POST", body: { reason } });
      toast("Order refunded");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="section-title">Orders</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input" placeholder="Search order number…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost btn-sm">Search</button>
        </form>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} orders`} /> : (
        <div className="grid gap-3">
          {items.map((vo) => (
            <div key={vo.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{vo.order.orderNumber} <StatusBadge status={vo.status} /></p>
                <p className="muted text-xs">{vo.vendor.businessName} · {vo.order.recipientName} · {vo.items.length} item(s) · {formatMoney(vo.total)}</p>
                <p className="muted text-xs">{new Date(vo.createdAt).toLocaleString()}</p>
              </div>
              {REFUNDABLE.has(vo.status) && vo.refunds.length === 0 && (
                <button onClick={() => refund(vo.id)} className="btn-danger btn-sm">Refund</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
