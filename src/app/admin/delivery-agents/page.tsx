"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, useToast, EmptyState, StatusBadge } from "@/components/ui";

type AgentRow = {
  id: string; vehicleType: string; city: string; region: string; verification: string;
  user: { name: string; email: string; phone: string | null };
};

const TABS = ["pending", "verified", "rejected"] as const;

export default function AdminDeliveryAgentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [items, setItems] = useState<AgentRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: AgentRow[] }>(`/admin/delivery-agents?verification=${tab}`);
    setItems(res.items);
  }

  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setVerification(id: string, verification: "verified" | "rejected") {
    try {
      await api(`/admin/delivery-agents/${id}`, { method: "PATCH", body: { verification } });
      toast(`Agent marked ${verification}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Delivery agents</h1>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} agents`} /> : (
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{a.user.name} <StatusBadge status={a.verification} /></p>
                <p className="muted text-xs">{a.user.email} · {a.user.phone ?? "no phone on file"}</p>
                <p className="muted text-xs capitalize">{a.vehicleType.replace("_", " ")} · {a.city}, {a.region}</p>
              </div>
              <div className="flex gap-2">
                {a.verification !== "verified" && <button onClick={() => setVerification(a.id, "verified")} className="btn-primary btn-sm">Verify</button>}
                {a.verification !== "rejected" && <button onClick={() => setVerification(a.id, "rejected")} className="btn-danger btn-sm">Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
