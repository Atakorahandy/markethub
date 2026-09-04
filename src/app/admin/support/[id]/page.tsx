"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, StatusBadge, useToast } from "@/components/ui";

type Message = { id: string; authorName: string; authorRole: string; body: string; createdAt: string };
type Ticket = {
  id: string; subject: string; category: string; status: string; orderNumber: string;
  openedByName: string; assignedTo: { name: string } | null; messages: Message[];
};

const STATUSES = ["open", "pending", "resolved", "closed"] as const;

export default function AdminSupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<Ticket>(`/admin/support/tickets/${id}`).then(setTicket, () => setTicket(null));
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/admin/support/tickets/${id}/messages`, { method: "POST", body: { body: reply } });
      setReply("");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    try {
      await api(`/admin/support/tickets/${id}`, { method: "PATCH", body: { status } });
      toast(`Marked ${status}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function assignToMe() {
    try {
      await api(`/admin/support/tickets/${id}`, { method: "PATCH", body: { assignToMe: true } });
      toast("Assigned to you");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  if (ticket === undefined) return <Spinner />;
  if (!ticket) { router.replace("/admin/support"); return null; }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">{ticket.subject}</h1>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="muted text-sm">
        {ticket.openedByName} · {ticket.category}{ticket.orderNumber && ` · order ${ticket.orderNumber}`}
        {ticket.assignedTo ? ` · assigned to ${ticket.assignedTo.name}` : " · unassigned"}
      </p>

      <div className="flex flex-wrap gap-2">
        {!ticket.assignedTo && <button onClick={assignToMe} className="btn-ghost btn-sm">Assign to me</button>}
        {STATUSES.filter((s) => s !== ticket.status).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className="btn-ghost btn-sm">Mark {s}</button>
        ))}
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`card p-3 ${m.authorRole === "staff" ? "border-brand-300 bg-brand-50" : ""}`}>
            <p className="text-xs font-semibold">{m.authorName} <span className="muted font-normal">· {new Date(m.createdAt).toLocaleString()}</span></p>
            <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <form onSubmit={sendReply} className="card space-y-2 p-4">
          <textarea className="input" rows={3} placeholder="Reply to the customer…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</button>
        </form>
      )}
    </div>
  );
}
