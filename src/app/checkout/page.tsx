"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { useCart } from "@/components/cart-context";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, MOMO_NETWORKS } from "@/lib/constants";

type Address = { id: string; label: string; recipientName: string; phone: string; region: string; city: string; area: string; streetLine: string; isDefault: boolean };
type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];
type MomoNetwork = (typeof MOMO_NETWORKS)[number]["key"];

function CheckoutBody() {
  const { me, loading: sessionLoading } = useSession();
  const { cart, loading: cartLoading, refresh: refreshCart } = useCart();
  const router = useRouter();
  const { toast, node } = useToast();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [momoNetwork, setMomoNetwork] = useState<MomoNetwork>("mtn");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/checkout");
  }, [sessionLoading, me, router]);

  useEffect(() => {
    if (!me?.user) return;
    api<{ items: Address[] }>("/addresses").then((r) => {
      setAddresses(r.items);
      const def = r.items.find((a) => a.isDefault) ?? r.items[0];
      if (def) setAddressId(def.id);
    });
  }, [me]);

  if (sessionLoading || cartLoading || !addresses) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!cart || cart.lines.length === 0) {
    return <EmptyState title="Your cart is empty" hint="Add products before checking out." />;
  }
  if (!cart.readyToCheckout) {
    return <EmptyState title="Your cart needs attention" hint="Some items are unavailable or exceed stock. Fix your cart before checking out." />;
  }

  async function placeOrder() {
    if (!addressId) {
      toast("Select a delivery address", "err");
      return;
    }
    setPlacing(true);
    try {
      const order = await api<{ orderNumber: string; payment: { authorizationUrl: string } }>("/checkout", {
        method: "POST",
        body: { addressId, clientRequestId, paymentMethod, momoNetwork: paymentMethod === "momo" ? momoNetwork : undefined },
      });
      await refreshCart();
      if (order.payment?.authorizationUrl) {
        window.location.href = order.payment.authorizationUrl;
      } else {
        router.push(`/orders/${order.orderNumber}`);
      }
    } catch (e: any) {
      toast(e.message, "err");
      setPlacing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {node}
      <div className="space-y-6">
        <h1 className="section-title">Checkout</h1>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">1. Delivery address</h2>
          {addresses.length === 0 ? (
            <p className="muted text-sm">
              You don&apos;t have a saved address yet. <Link href="/account/addresses" className="link">Add one</Link> to continue.
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${addressId === a.id ? "border-brand-600 bg-brand-50" : "border-[var(--border)]"}`}>
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1" />
                  <div className="text-sm">
                    <p className="font-medium capitalize">{a.label} — {a.recipientName} · {a.phone}</p>
                    <p className="muted">{a.streetLine}{a.streetLine && ", "}{a.area}{a.area && ", "}{a.city}, {a.region}</p>
                  </div>
                </label>
              ))}
              <Link href="/account/addresses" className="link block text-sm">Manage addresses</Link>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">2. Order review</h2>
          <div className="space-y-4">
            {cart.vendorGroups.map((group) => (
              <div key={group.vendorId}>
                <p className="text-sm font-semibold">{group.vendorName}</p>
                {group.lines.map((line) => (
                  <div key={line.id} className="flex justify-between text-sm">
                    <span className="muted">{line.productName}{line.variantLabel ? ` (${line.variantLabel})` : ""} × {line.quantity}</span>
                    <span>{formatMoney(line.lineTotal)}</span>
                  </div>
                ))}
                <div className="muted flex justify-between text-xs"><span>Delivery</span><span>{formatMoney(group.deliveryFee)}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">3. Payment method</h2>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPaymentMethod(m.key)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${paymentMethod === m.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-[var(--border)]"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {paymentMethod === "momo" && (
            <div className="mt-3">
              <label className="label">Network</label>
              <select className="select" value={momoNetwork} onChange={(e) => setMomoNetwork(e.target.value as MomoNetwork)}>
                {MOMO_NETWORKS.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
              </select>
            </div>
          )}
          <p className="muted mt-3 text-xs">
            You&apos;ll be redirected to complete payment securely. We never see or store your card or Mobile Money PIN.
          </p>
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-5">
        <h2 className="font-bold">Total</h2>
        <div className="flex justify-between text-sm"><span className="muted">Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="muted">Delivery</span><span>{formatMoney(cart.deliveryFee)}</span></div>
        <div className="flex justify-between border-t border-[var(--border)] pt-3 font-bold"><span>Total</span><span>{formatMoney(cart.total)}</span></div>
        <button onClick={placeOrder} disabled={placing || !addressId} className="btn-primary w-full">
          {placing ? "Redirecting to payment…" : "Place order & pay"}
        </button>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  return <ShopChrome><CheckoutBody /></ShopChrome>;
}
