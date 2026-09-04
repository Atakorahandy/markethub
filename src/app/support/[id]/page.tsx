"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { api } from "@/lib/client";

type Message = { id: string; authorName: string; authorRole: string; body: string; createdAt: string };
type Ticket = { id: string; subject: string; category: string; status: string; orderNumber: string; messages: Message[] };

function TicketBody() {
  const { id } = useParams<{ id: string }>();
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<Ticket>(`/support/tickets/${id}`).then(setTicket, () => setTicket(null));
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace(`/login?next=/support/${id}`);
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/support/tickets/${id}/messages`, { method: "POST", body: { body: reply } });
      setReply("");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || ticket === undefined) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!ticket) return <p className="muted py-16 text-center">This ticket could not be found.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">{ticket.subject}</h1>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="muted text-sm">{ticket.category}{ticket.orderNumber && ` · order ${ticket.orderNumber}`}</p>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`card p-3 ${m.authorRole === "staff" ? "border-brand-300 bg-brand-50" : ""}`}>
            <p className="text-xs font-semibold">{m.authorRole === "staff" ? "MarketHub Support" : m.authorName} <span className="muted font-normal">· {new Date(m.createdAt).toLocaleString()}</span></p>
            <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status === "closed" ? (
        <p className="muted text-sm">This ticket is closed. Open a new one from the Support page if you still need help.</p>
      ) : (
        <form onSubmit={sendReply} className="card space-y-2 p-4">
          <textarea className="input" rows={3} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send"}</button>
        </form>
      )}
    </div>
  );
}

export default function SupportTicketPage() {
  return <ShopChrome><TicketBody /></ShopChrome>;
}
