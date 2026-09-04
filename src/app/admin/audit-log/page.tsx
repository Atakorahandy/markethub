"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState } from "@/components/ui";

type LogRow = { id: string; actorName: string; action: string; entityType: string; entityId: string; createdAt: string };

export default function AdminAuditLogPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LogRow[] | null>(null);

  async function load() {
    setItems(null);
    const res = await api<{ items: LogRow[] }>(`/admin/audit-log?pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    setItems(res.items);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="section-title">Audit log</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input" placeholder="Search action, actor, entity…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost btn-sm">Search</button>
        </form>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No matching log entries" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">When</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Entity</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td className="td whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="td">{l.actorName || "system"}</td>
                  <td className="td font-medium">{l.action}</td>
                  <td className="td muted">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 10)}…` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
