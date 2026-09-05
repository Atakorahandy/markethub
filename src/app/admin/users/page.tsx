"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, useToast, EmptyState } from "@/components/ui";

type UserRow = { id: string; name: string; email: string; phone: string | null; kind: string; isActive: boolean; createdAt: string; mfaEnabledAt: string | null };

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState("");
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: UserRow[] }>(`/admin/users?q=${encodeURIComponent(q)}`);
    setItems(res.items);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(u: UserRow) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } });
      toast(u.isActive ? "User suspended" : "User activated");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function resetMfa(u: UserRow) {
    if (!window.confirm(`Turn off two-factor authentication for ${u.name}? Only do this after verifying their identity out of band.`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { disableMfa: true } });
      toast("Two-factor authentication reset");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex items-center justify-between gap-3">
        <h1 className="section-title">Users</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost btn-sm">Search</button>
        </form>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Phone</th><th className="th">Type</th><th className="th">Status</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="td font-medium">{u.name}</td>
                  <td className="td">{u.email}</td>
                  <td className="td">{u.phone ?? "—"}</td>
                  <td className="td capitalize">{u.kind.replace("_", " ")}</td>
                  <td className="td"><span className={`badge ${u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>{u.isActive ? "active" : "suspended"}</span></td>
                  <td className="td text-right">
                    {u.mfaEnabledAt && (
                      <button onClick={() => resetMfa(u)} className="btn-ghost btn-sm mr-2">Reset 2FA</button>
                    )}
                    <button onClick={() => toggle(u)} className={u.isActive ? "btn-danger btn-sm" : "btn-primary btn-sm"}>
                      {u.isActive ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
