"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";

type Category = { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; isActive: boolean };

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: Category[] }>("/admin/categories");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/categories", { method: "POST", body: { name, parentId: parentId || null } });
      setName("");
      toast("Category created");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api(`/admin/categories/${id}`, { method: "DELETE" });
      toast("Category deleted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  const top = items?.filter((c) => !c.parentId) ?? [];

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Categories</h1>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Parent (optional)</label>
          <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top-level category</option>
            {top.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-primary btn-sm">Add category</button>
      </form>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No categories yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Slug</th><th className="th">Parent</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="td font-medium">{c.parentId ? "— " : ""}{c.name}</td>
                  <td className="td muted">{c.slug}</td>
                  <td className="td">{items.find((p) => p.id === c.parentId)?.name ?? "—"}</td>
                  <td className="td text-right"><button onClick={() => remove(c.id)} className="text-xs text-red-600 hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
