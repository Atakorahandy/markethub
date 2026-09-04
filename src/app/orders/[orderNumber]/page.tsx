"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, MOMO_NETWORKS } from "@/lib/constants";

type OrderDetail = {
  orderNumber: string; status: string; createdAt: string;
  recipientName: string; phone: string; region: string; city: string; area: string; streetLine: string; deliveryInstructions: string;
  subtotal: number; deliveryFee: number; total: number;
  payment: { status: string; method: string; momoNetwork: string } | null;
  vendorOrders: {
    id: string; status: string; subtotal: number; deliveryFee: number; total: number;
    vendor: { businessName: string; slug: string };
    items: { id: string; nameSnapshot: string; imageSnapshot: string; priceSnapshot: number; quantity: number }[];
    delivery: {
      status: string; otpCode: string | null; assignedAt: string | null; pickedUpAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null;
      agent: { user: { name: string; phone: string } } | null;
    } | null;
  }[];
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending_assignment: "Looking for a delivery agent…",
  assigned: "Delivery agent assigned",
  picked_up: "Picked up from vendor",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery attempt failed",
};

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];
type MomoNetwork = (typeof MOMO_NETWORKS)[number]["key"];

function OrderDetailBody() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [momoNetwork, setMomoNetwork] = useState<MomoNetwork>("mtn");
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

  async function payNow() {
    setPaying(true);
    try {
      const res = await api<{ authorizationUrl: string }>(`/orders/${orderNumber}/pay`, {
        method: "POST",
        body: { paymentMethod, momoNetwork: paymentMethod === "momo" ? momoNetwork : undefined },
      });
      window.location.href = res.authorizationUrl;
    } catch (e: any) {
      toast(e.message, "err");
      setPaying(false);
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

      {order.status === "paid" && (
        <div className="card border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment received{order.payment ? ` via ${order.payment.method === "momo" ? "Mobile Money" : "Card"}` : ""}. Your vendor(s) will start preparing your order.
        </div>
      )}

      {order.status === "pending_payment" && (
        <div className="card space-y-3 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            This order is awaiting payment{order.payment?.status === "FAILED" ? " — your last attempt failed" : ""}.
            Items are held for you; complete payment to confirm your order.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPaymentMethod(m.key)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${paymentMethod === m.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-[var(--border)] bg-white"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {paymentMethod === "momo" && (
            <select className="select" value={momoNetwork} onChange={(e) => setMomoNetwork(e.target.value as MomoNetwork)}>
              {MOMO_NETWORKS.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <button onClick={payNow} disabled={paying} className="btn-primary btn-sm">{paying ? "Redirecting…" : "Pay now"}</button>
            <button onClick={cancel} disabled={cancelling} className="btn-danger btn-sm">{cancelling ? "Cancelling…" : "Cancel order"}</button>
          </div>
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

          {vo.delivery && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-sm font-medium">{DELIVERY_STATUS_LABEL[vo.delivery.status] ?? vo.delivery.status}</p>
              {vo.delivery.agent && (
                <p className="muted text-xs">Agent: {vo.delivery.agent.user.name} · {vo.delivery.agent.user.phone}</p>
              )}
              {vo.delivery.otpCode && (
                <div className="mt-2 rounded-xl bg-brand-50 p-3 text-center">
                  <p className="muted text-xs">Give this code to your delivery agent to confirm receipt</p>
                  <p className="text-2xl font-bold tracking-widest text-brand-700">{vo.delivery.otpCode}</p>
                </div>
              )}
            </div>
          )}
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
