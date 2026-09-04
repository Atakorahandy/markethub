"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";

type CmsRow = { id: string; slug: string; title: string; published: boolean; updatedAt: string };

export default function AdminCmsPage() {
  const [items, setItems] = useState<CmsRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: CmsRow[] }>("/admin/cms");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this page? This cannot be undone.")) return;
    try {
      await api(`/admin/cms/${id}`, { method: "DELETE" });
      toast("Page deleted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">CMS pages</h1>
        <Link href="/admin/cms/new" className="btn-primary btn-sm">New page</Link>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="No pages yet" hint="Create About, Terms, FAQ, or any other static page." />
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{p.title} <StatusBadge status={p.published ? "published" : "unpublished"} /></p>
                <p className="muted text-xs">/page/{p.slug} · updated {new Date(p.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/cms/${p.id}`} className="link text-xs">Edit</Link>
                <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
