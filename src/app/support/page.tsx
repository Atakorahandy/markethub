"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";
import { api } from "@/lib/client";

type TicketRow = { id: string; subject: string; category: string; status: string; updatedAt: string };

const CATEGORIES = [
  { key: "general", label: "General question" },
  { key: "order", label: "An order" },
  { key: "payment", label: "A payment" },
  { key: "vendor", label: "A vendor" },
  { key: "other", label: "Other" },
] as const;

function SupportBody() {
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["key"]>("general");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: TicketRow[] }>("/support/tickets");
    setTickets(res.items);
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/support");
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/support/tickets", { method: "POST", body: { subject, category, orderNumber: orderNumber || undefined, message } });
      toast("Ticket opened — we'll reply here");
      setSubject(""); setOrderNumber(""); setMessage(""); setShowNew(false);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || tickets === null) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">Support</h1>
        <button onClick={() => setShowNew((v) => !v)} className="btn-primary btn-sm">{showNew ? "Cancel" : "New ticket"}</button>
      </div>

      {showNew && (
        <form onSubmit={submit} className="card space-y-3 p-5">
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Order number (optional)</label>
              <input className="input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="MH-XXXXXX" />
            </div>
          </div>
          <div>
            <label className="label">How can we help?</label>
            <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? "Opening…" : "Open ticket"}</button>
        </form>
      )}

      {tickets.length === 0 && !showNew ? (
        <EmptyState title="No support tickets yet" hint="Need help? Open a new ticket above." />
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => (
            <Link key={t.id} href={`/support/${t.id}`} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{t.subject} <StatusBadge status={t.status} /></p>
                <p className="muted text-xs">{t.category} · updated {new Date(t.updatedAt).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return <ShopChrome><SupportBody /></ShopChrome>;
}
