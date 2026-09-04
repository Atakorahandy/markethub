"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, useToast, EmptyState, StatusBadge } from "@/components/ui";

type VendorRow = {
  id: string; businessName: string; city: string; region: string; status: string;
  owner: { name: string; email: string; phone: string | null };
};

const TABS = ["pending", "under_review", "approved", "rejected", "suspended"] as const;

export default function AdminVendorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [items, setItems] = useState<VendorRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: VendorRow[] }>(`/admin/vendors?status=${tab}`);
    setItems(res.items);
  }

  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: string) {
    let rejectionNote: string | undefined;
    if (status === "rejected") {
      rejectionNote = window.prompt("Reason for rejection (shown to the vendor):") ?? undefined;
      if (rejectionNote === undefined) return;
    }
    try {
      await api(`/admin/vendors/${id}`, { method: "PATCH", body: { status, rejectionNote } });
      toast(`Vendor marked ${status.replace("_", " ")}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Vendors</h1>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab.replace("_", " ")} vendors`} /> : (
        <div className="grid gap-3">
          {items.map((v) => (
            <div key={v.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{v.businessName} <StatusBadge status={v.status} /></p>
                <p className="muted text-xs">{v.owner.name} · {v.owner.email} · {v.owner.phone ?? "no phone on file"}</p>
                <p className="muted text-xs">{v.city}, {v.region}</p>
              </div>
              <div className="flex gap-2">
                {v.status !== "approved" && <button onClick={() => setStatus(v.id, "approved")} className="btn-primary btn-sm">Approve</button>}
                {v.status !== "rejected" && <button onClick={() => setStatus(v.id, "rejected")} className="btn-danger btn-sm">Reject</button>}
                {v.status === "approved" && <button onClick={() => setStatus(v.id, "suspended")} className="btn-ghost btn-sm">Suspend</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
