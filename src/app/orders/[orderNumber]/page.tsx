"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type OrderDetail = {
  orderNumber: string; status: string; createdAt: string;
  recipientName: string; phone: string; region: string; city: string; area: string; streetLine: string; deliveryInstructions: string;
  subtotal: number; deliveryFee: number; total: number;
  vendorOrders: {
    id: string; status: string; subtotal: number; deliveryFee: number; total: number;
    vendor: { businessName: string; slug: string };
    items: { id: string; nameSnapshot: string; imageSnapshot: string; priceSnapshot: number; quantity: number }[];
  }[];
};

function OrderDetailBody() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<OrderDetail>(`/orders/${orderNumber}`).then(setOrder, () => setOrder(null));
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace(`/login?next=/orders/${orderNumber}`);
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await api(`/orders/${orderNumber}/cancel`, { method: "POST" });
      toast("Order cancelled");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setCancelling(false);
    }
  }

  if (sessionLoading || order === undefined) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!order) return <p className="muted py-16 text-center">This order could not be found.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">{order.orderNumber}</h1>
          <p className="muted text-sm">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.status === "pending_payment" && (
        <div className="card border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          This order is unpaid. MarketHub Phase 4 adds Mobile Money / card payment — for now it's held as a
          placeholder order.
          <button onClick={cancel} disabled={cancelling} className="btn-danger btn-sm ml-3">
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      )}

      <div className="card p-5">
        <p className="font-semibold">Delivery address</p>
        <p className="text-sm">{order.recipientName} · {order.phone}</p>
        <p className="muted text-sm">{order.streetLine}{order.streetLine && ", "}{order.area}{order.area && ", "}{order.city}, {order.region}</p>
        {order.deliveryInstructions && <p className="muted text-sm">Note: {order.deliveryInstructions}</p>}
      </div>

      {order.vendorOrders.map((vo) => (
        <div key={vo.id} className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">{vo.vendor.businessName}</p>
            <StatusBadge status={vo.status} />
          </div>
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
        </div>
      ))}

      <div className="card space-y-2 p-5">
        <div className="flex justify-between text-sm"><span className="muted">Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="muted">Delivery</span><span>{formatMoney(order.deliveryFee)}</span></div>
        <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><span>Total</span><span>{formatMoney(order.total)}</span></div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return <ShopChrome><OrderDetailBody /></ShopChrome>;
}
