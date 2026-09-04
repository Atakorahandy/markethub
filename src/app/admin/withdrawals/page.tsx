"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type WithdrawalRow = {
  id: string; amount: number; status: string; payoutBank: string; payoutAccount: string;
  requestedAt: string; vendor: { businessName: string; slug: string };
};

const TABS = ["pending", "approved", "rejected", "completed"] as const;

export default function AdminWithdrawalsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [items, setItems] = useState<WithdrawalRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    setItems(null);
    const res = await api<{ items: WithdrawalRow[] }>(`/admin/withdrawals?status=${tab}`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: "approved" | "rejected" | "completed") {
    let reviewNote: string | undefined;
    if (status === "rejected") {
      reviewNote = window.prompt("Reason for rejection (funds return to the vendor's wallet):") ?? undefined;
      if (reviewNote === undefined) return;
    }
    try {
      await api(`/admin/withdrawals/${id}`, { method: "PATCH", body: { status, reviewNote } });
      toast(`Withdrawal marked ${status}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Withdrawals</h1>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>
            {t}
          </button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} withdrawals`} /> : (
        <div className="grid gap-3">
          {items.map((w) => (
            <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{w.vendor.businessName} <StatusBadge status={w.status} /></p>
                <p className="muted text-xs">{formatMoney(w.amount)} · requested {new Date(w.requestedAt).toLocaleDateString()}</p>
                <p className="muted text-xs">{w.payoutBank} · {w.payoutAccount}</p>
              </div>
              <div className="flex gap-2">
                {w.status === "pending" && <button onClick={() => setStatus(w.id, "approved")} className="btn-primary btn-sm">Approve</button>}
                {w.status === "pending" && <button onClick={() => setStatus(w.id, "rejected")} className="btn-danger btn-sm">Reject</button>}
                {w.status === "approved" && <button onClick={() => setStatus(w.id, "completed")} className="btn-primary btn-sm">Mark paid out</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
