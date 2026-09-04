"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function NewCmsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/admin/cms", { method: "POST", body: { title, content, published } });
      router.push("/admin/cms");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="section-title">New page</h1>
      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Content</label>
          <textarea className="input" rows={12} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Plain text — separate paragraphs with a blank line." />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible at /page/…)
        </label>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Create page"}</button>
    </form>
  );
}
