"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type DeliveryDetail = {
  id: string; status: string; agentEarning: number; failureReason: string;
  vendorOrder: {
    vendor: { businessName: string; addressLine: string; city: string; region: string; phone: string };
    order: { orderNumber: string; recipientName: string; phone: string; streetLine: string; area: string; city: string; region: string; deliveryInstructions: string };
    items: { nameSnapshot: string; quantity: number }[];
  };
};

const NEXT_STATUS: Record<string, "picked_up" | "out_for_delivery" | undefined> = {
  assigned: "picked_up",
  picked_up: "out_for_delivery",
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<DeliveryDetail | null | undefined>(undefined);
  const [otp, setOtp] = useState("");
  const [failReason, setFailReason] = useState("");
  const [showFail, setShowFail] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<DeliveryDetail>(`/delivery/deliveries/${id}`).then(setD, () => setD(null));
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance() {
    const next = d && NEXT_STATUS[d.status];
    if (!next) return;
    setBusy(true);
    try {
      await api(`/delivery/deliveries/${id}/status`, { method: "PATCH", body: { status: next } });
      toast(`Marked ${next.replace(/_/g, " ")}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelivery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/delivery/deliveries/${id}/confirm`, { method: "POST", body: { otp } });
      toast("Delivery confirmed — earnings credited");
      router.push("/delivery/deliveries");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function reportFailure(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/delivery/deliveries/${id}/fail`, { method: "POST", body: { reason: failReason } });
      toast("Delivery marked as failed");
      router.push("/delivery/deliveries");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (d === undefined) return <Spinner />;
  if (!d) return <p className="muted">This delivery could not be found.</p>;

  const next = NEXT_STATUS[d.status];
  const active = ["assigned", "picked_up", "out_for_delivery"].includes(d.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">{d.vendorOrder.order.orderNumber}</h1>
        <StatusBadge status={d.status} />
      </div>

      {d.status === "failed" && (
        <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-800">Failed: {d.failureReason}</div>
      )}
      {d.status === "delivered" && (
        <div className="card border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          Delivered — you earned {formatMoney(d.agentEarning)}.
        </div>
      )}

      <div className="card p-5">
        <p className="font-semibold">1. Pick up from</p>
        <p className="text-sm">{d.vendorOrder.vendor.businessName} · {d.vendorOrder.vendor.phone}</p>
        <p className="muted text-sm">{d.vendorOrder.vendor.addressLine}{d.vendorOrder.vendor.addressLine && ", "}{d.vendorOrder.vendor.city}, {d.vendorOrder.vendor.region}</p>
      </div>

      <div className="card p-5">
        <p className="font-semibold">2. Deliver to</p>
        <p className="text-sm">{d.vendorOrder.order.recipientName} · {d.vendorOrder.order.phone}</p>
        <p className="muted text-sm">{d.vendorOrder.order.streetLine}{d.vendorOrder.order.streetLine && ", "}{d.vendorOrder.order.area}{d.vendorOrder.order.area && ", "}{d.vendorOrder.order.city}, {d.vendorOrder.order.region}</p>
        {d.vendorOrder.order.deliveryInstructions && <p className="muted text-sm">Note: {d.vendorOrder.order.deliveryInstructions}</p>}
      </div>

      <div className="card p-5">
        <p className="mb-2 font-semibold">Items</p>
        <div className="space-y-1 text-sm">
          {d.vendorOrder.items.map((item, i) => <p key={i}>{item.nameSnapshot} × {item.quantity}</p>)}
        </div>
        <p className="muted mt-2 text-xs">You earn {formatMoney(d.agentEarning)} for this delivery.</p>
      </div>

      {active && (
        <div className="card space-y-3 p-5">
          {next && (
            <button onClick={advance} disabled={busy} className="btn-primary w-full">
              {busy ? "Updating…" : `Mark as ${next.replace(/_/g, " ")}`}
            </button>
          )}

          {d.status === "out_for_delivery" && (
            <form onSubmit={confirmDelivery} className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="label">Ask the customer for their 4-digit delivery code</label>
              <input className="input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} required />
              <button className="btn-primary w-full" disabled={busy || otp.length !== 4}>{busy ? "Confirming…" : "Confirm delivery"}</button>
            </form>
          )}

          {!showFail ? (
            <button onClick={() => setShowFail(true)} className="link block w-full text-center text-sm text-red-600">Report a problem</button>
          ) : (
            <form onSubmit={reportFailure} className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="label">What went wrong?</label>
              <textarea className="input" rows={2} value={failReason} onChange={(e) => setFailReason(e.target.value)} required />
              <button className="btn-danger w-full" disabled={busy}>{busy ? "Reporting…" : "Report failed delivery"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
