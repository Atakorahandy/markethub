"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui";

type TicketRow = {
  id: string; subject: string; category: string; status: string; openedByName: string; updatedAt: string;
  assignedTo: { name: string } | null; _count: { messages: number };
};

const TABS = ["open", "pending", "resolved", "closed"] as const;

export default function AdminSupportPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("open");
  const [items, setItems] = useState<TicketRow[] | null>(null);

  async function load() {
    setItems(null);
    const res = await api<{ items: TicketRow[] }>(`/admin/support/tickets?status=${tab}`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <h1 className="section-title">Support</h1>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-black/5"}`}>{t}</button>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${tab} tickets`} /> : (
        <div className="grid gap-3">
          {items.map((t) => (
            <Link key={t.id} href={`/admin/support/${t.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{t.subject} <StatusBadge status={t.status} /></p>
                <p className="muted text-xs">
                  {t.openedByName} · {t.category} · {t._count.messages} message{t._count.messages === 1 ? "" : "s"}
                  {t.assignedTo && ` · assigned to ${t.assignedTo.name}`}
                </p>
              </div>
              <p className="muted text-xs">{new Date(t.updatedAt).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
