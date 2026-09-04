"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type ProductRow = {
  id: string; name: string; price: number; discountPrice: number | null; stock: number; status: string; isFeatured: boolean;
  vendor: { businessName: string; slug: string }; category: { name: string };
};

const TABS = ["pending_review", "active", "rejected", "suspended", "draft", "out_of_stock"] as const;

export default function AdminProductsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending_review");
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: ProductRow[] }>(`/admin/products?status=${tab}&pageSize=50`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    try {
      await api(`/admin/products/${id}`, { method: "PATCH", body: { status: "active" } });
      toast("Product approved — now live");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function rejectOrSuspend(id: string, status: "rejected" | "suspended") {
    const moderationNote = window.prompt(`Reason (shown to the vendor):`) ?? undefined;
    if (!moderationNote) return;
    try {
      await api(`/admin/products/${id}`, { method: "PATCH", body: { status, moderationNote } });
      toast(`Product marked ${status}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function toggleFeatured(id: string, isFeatured: boolean) {
    try {
      await api(`/admin/products/${id}`, { method: "PATCH", body: { isFeatured: !isFeatured } });
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Products</h1>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab.replace(/_/g, " ")} products`} /> : (
        <div className="grid gap-3">
          {items.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{p.name} <StatusBadge status={p.status} /> {p.isFeatured && <span className="badge bg-violet-100 text-violet-800">featured</span>}</p>
                <p className="muted text-xs">{p.vendor.businessName} · {p.category.name} · {formatMoney(p.discountPrice ?? p.price)}</p>
              </div>
              <div className="flex gap-2">
                {p.status === "pending_review" && <button onClick={() => approve(p.id)} className="btn-primary btn-sm">Approve</button>}
                {p.status !== "rejected" && <button onClick={() => rejectOrSuspend(p.id, "rejected")} className="btn-danger btn-sm">Reject</button>}
                {p.status === "active" && <button onClick={() => rejectOrSuspend(p.id, "suspended")} className="btn-ghost btn-sm">Suspend</button>}
                {p.status === "active" && <button onClick={() => toggleFeatured(p.id, p.isFeatured)} className="btn-ghost btn-sm">{p.isFeatured ? "Unfeature" : "Feature"}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
