"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";

type ReviewRow = {
  id: string; rating: number; title: string; body: string; status: string; vendorReply: string; createdAt: string;
  product: { name: string; slug: string }; vendor: { businessName: string }; customer: { name: string };
};

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

const TABS = ["published", "hidden"] as const;

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("published");
  const [items, setItems] = useState<ReviewRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: ReviewRow[] }>(`/admin/reviews?status=${tab}&pageSize=50`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: "published" | "hidden") {
    try {
      await api(`/admin/reviews/${id}`, { method: "PATCH", body: { status } });
      toast(`Review ${status}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Reviews</h1>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>{t}</button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} reviews`} /> : (
        <div className="grid gap-3">
          {items.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{r.product.name} <span className="muted text-xs font-normal">· {r.vendor.businessName}</span></p>
                <Stars n={r.rating} />
              </div>
              <p className="muted text-xs">{r.customer.name} · {new Date(r.createdAt).toLocaleDateString()}</p>
              {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
              {r.body && <p className="text-sm">{r.body}</p>}
              {r.vendorReply && <div className="mt-2 rounded-xl bg-black/5 p-3 text-sm"><p className="font-medium">Vendor reply</p><p>{r.vendorReply}</p></div>}
              <div className="mt-3">
                {r.status === "published" ? (
                  <button onClick={() => setStatus(r.id, "hidden")} className="btn-danger btn-sm">Hide</button>
                ) : (
                  <button onClick={() => setStatus(r.id, "published")} className="btn-primary btn-sm">Publish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
