"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { VENDOR_ORDER_STATUS_FLOW } from "@/lib/constants";

type VendorOrderDetail = {
  id: string; status: string; subtotal: number; deliveryFee: number; discountAmount: number; total: number; walletCreditedAt: string | null;
  items: { id: string; nameSnapshot: string; imageSnapshot: string; priceSnapshot: number; quantity: number }[];
  history: { id: string; status: string; note: string; actorName: string; createdAt: string }[];
  order: {
    orderNumber: string; recipientName: string; phone: string; streetLine: string; area: string;
    city: string; region: string; deliveryInstructions: string; createdAt: string;
  };
};

const NEXT_STATUS: Record<string, string | undefined> = {
  paid: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export default function VendorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vo, setVo] = useState<VendorOrderDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<VendorOrderDetail>(`/vendor/orders/${id}`).then(setVo, () => setVo(null));
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance() {
    const next = vo && NEXT_STATUS[vo.status];
    if (!next) return;
    setBusy(true);
    try {
      await api(`/vendor/orders/${id}/status`, { method: "PATCH", body: { status: next } });
      toast(`Marked ${next}`);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (vo === undefined) return <Spinner />;
  if (!vo) return <p className="muted">This order could not be found.</p>;

  const next = NEXT_STATUS[vo.status];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">{vo.order.orderNumber}</h1>
        <StatusBadge status={vo.status} />
      </div>

      {next && (
        <div className="card p-4">
          <button onClick={advance} disabled={busy} className="btn-primary btn-sm">
            {busy ? "Updating…" : `Mark as ${next}`}
          </button>
          <p className="muted mt-2 text-xs">Orders advance one step at a time: {VENDOR_ORDER_STATUS_FLOW.join(" → ")}.</p>
        </div>
      )}
      {vo.status === "delivered" && vo.walletCreditedAt && (
        <div className="card border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          Delivered — your earnings for this order were credited to your wallet.
        </div>
      )}

      <div className="card p-5">
        <p className="font-semibold">Deliver to</p>
        <p className="text-sm">{vo.order.recipientName} · {vo.order.phone}</p>
        <p className="muted text-sm">{vo.order.streetLine}{vo.order.streetLine && ", "}{vo.order.area}{vo.order.area && ", "}{vo.order.city}, {vo.order.region}</p>
        {vo.order.deliveryInstructions && <p className="muted text-sm">Note: {vo.order.deliveryInstructions}</p>}
      </div>

      <div className="card p-5">
        <p className="mb-2 font-semibold">Items</p>
        <div className="space-y-2">
          {vo.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.nameSnapshot} × {item.quantity}</span>
              <span>{formatMoney(item.priceSnapshot * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="muted mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-xs">
          <span>Delivery</span><span>{formatMoney(vo.deliveryFee)}</span>
        </div>
        {vo.discountAmount > 0 && (
          <div className="flex justify-between text-xs text-emerald-700"><span>Coupon discount</span><span>-{formatMoney(vo.discountAmount)}</span></div>
        )}
        <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-2 text-sm font-bold">
          <span>Total</span><span>{formatMoney(vo.total)}</span>
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-2 font-semibold">History</p>
        <div className="space-y-2 text-sm">
          {vo.history.map((h) => (
            <div key={h.id} className="flex justify-between">
              <span className="capitalize">{h.status.replace("_", " ")}{h.note ? ` — ${h.note}` : ""}</span>
              <span className="muted text-xs">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
