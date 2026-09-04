"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";

type ReviewRow = {
  id: string; rating: number; title: string; body: string; vendorReply: string; createdAt: string;
  product: { name: string; slug: string }; customer: { name: string };
};

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

export default function VendorReviewsPage() {
  const [items, setItems] = useState<ReviewRow[] | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: ReviewRow[] }>("/vendor/reviews");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function reply(id: string) {
    const text = (replyDraft[id] ?? "").trim();
    if (!text) return;
    setBusyId(id);
    try {
      await api(`/vendor/reviews/${id}`, { method: "PATCH", body: { vendorReply: text } });
      toast("Reply posted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Reviews</h1>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No reviews yet" hint="Reviews appear here once customers rate a delivered order." /> : (
        <div className="grid gap-3">
          {items.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{r.product.name}</p>
                <Stars n={r.rating} />
              </div>
              <p className="muted text-xs">{r.customer.name} · {new Date(r.createdAt).toLocaleDateString()}</p>
              {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
              {r.body && <p className="text-sm">{r.body}</p>}

              {r.vendorReply ? (
                <div className="mt-3 rounded-xl bg-black/5 p-3 text-sm">
                  <p className="font-medium">Your reply</p>
                  <p>{r.vendorReply}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    placeholder="Reply to this review…"
                    value={replyDraft[r.id] ?? ""}
                    onChange={(e) => setReplyDraft({ ...replyDraft, [r.id]: e.target.value })}
                  />
                  <button onClick={() => reply(r.id)} disabled={busyId === r.id} className="btn-ghost btn-sm shrink-0">
                    {busyId === r.id ? "Posting…" : "Reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
