"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, useToast } from "@/components/ui";

type CmsPage = { id: string; slug: string; title: string; content: string; published: boolean };

export default function EditCmsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    api<CmsPage>(`/admin/cms/${id}`).then(setPage, () => setErr("Could not load this page."));
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!page) return;
    setErr("");
    setBusy(true);
    try {
      await api(`/admin/cms/${id}`, { method: "PATCH", body: { title: page.title, content: page.content, published: page.published } });
      toast("Page saved");
      router.push("/admin/cms");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (!page) return err ? <p className="text-red-600">{err}</p> : <Spinner />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      {node}
      <h1 className="section-title">Edit page</h1>
      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Title</label>
          <input className="input" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} required />
        </div>
        <div>
          <label className="label">Content</label>
          <textarea className="input" rows={12} value={page.content} onChange={(e) => setPage({ ...page, content: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={page.published} onChange={(e) => setPage({ ...page, published: e.target.checked })} />
          Published — visible at /page/{page.slug}
        </label>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
