"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";

type Brand = { id: string; name: string; slug: string; logoUrl: string | null };

export default function AdminBrandsPage() {
  const [items, setItems] = useState<Brand[] | null>(null);
  const [name, setName] = useState("");
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: Brand[] }>("/admin/brands");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/brands", { method: "POST", body: { name } });
      setName("");
      toast("Brand created");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this brand?")) return;
    try {
      await api(`/admin/brands/${id}`, { method: "DELETE" });
      toast("Brand deleted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Brands</h1>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button className="btn-primary btn-sm">Add brand</button>
      </form>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No brands yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Slug</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td className="td font-medium">{b.name}</td>
                  <td className="td muted">{b.slug}</td>
                  <td className="td text-right"><button onClick={() => remove(b.id)} className="text-xs text-red-600 hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
