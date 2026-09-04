"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { useCart } from "@/components/cart-context";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

function CartBody() {
  const { me, loading: sessionLoading } = useSession();
  const { cart, loading, refresh } = useCart();
  const router = useRouter();
  const { toast, node } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (sessionLoading || loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!me?.user) { router.replace("/login?next=/cart"); return null; }

  async function setQty(id: string, quantity: number) {
    setBusyId(id);
    try {
      await api(`/cart/${id}`, { method: "PATCH", body: { quantity } });
      await refresh();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/cart/${id}`, { method: "DELETE" });
      await refresh();
      toast("Removed from cart");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusyId(null);
    }
  }

  if (!cart || cart.lines.length === 0) {
    return <EmptyState title="Your cart is empty" hint="Browse products and add something you like." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {node}
      <div className="space-y-4">
        <h1 className="section-title">My cart</h1>
        {cart.vendorGroups.map((group) => (
          <div key={group.vendorId} className="card p-4">
            <p className="mb-3 font-semibold">{group.vendorName}</p>
            <div className="space-y-3">
              {group.lines.map((line) => (
                <div key={line.id} className="flex gap-3 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-cover" />
                    ) : <div className="grid h-full place-items-center text-lg">🛍️</div>}
                  </div>
                  <div className="flex-1">
                    <Link href={`/product/${line.productSlug}`} className="text-sm font-medium hover:underline">{line.productName}</Link>
                    {line.variantLabel && <p className="muted text-xs">{line.variantLabel}</p>}
                    <p className="font-semibold text-brand-700">
                      {formatMoney(line.unitPrice)}
                      {line.onFlashSale && <span className="badge ml-2 bg-red-100 text-red-700">flash sale</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <input
                      type="number" min={1} max={line.availableStock} value={line.quantity}
                      disabled={busyId === line.id}
                      onChange={(e) => setQty(line.id, Math.max(1, Number(e.target.value)))}
                      className="input w-16 text-center"
                    />
                    <button onClick={() => remove(line.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="muted mt-3 border-t border-[var(--border)] pt-3 text-sm">
              Subtotal: <span className="font-semibold text-[var(--text)]">{formatMoney(group.subtotal)}</span> · Delivery: {formatMoney(group.deliveryFee)}
            </p>
          </div>
        ))}

        {cart.lines.some((l) => l.unavailable || l.exceedsStock) && (
          <div className="card border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Some items in your cart are no longer available or exceed available stock. Remove or adjust them to continue.
          </div>
        )}
      </div>

      <aside className="card h-fit space-y-3 p-5">
        <h2 className="font-bold">Order summary</h2>
        <div className="flex justify-between text-sm"><span className="muted">Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="muted">Delivery</span><span>{formatMoney(cart.deliveryFee)}</span></div>
        <div className="flex justify-between border-t border-[var(--border)] pt-3 font-bold"><span>Total</span><span>{formatMoney(cart.total)}</span></div>
        <Link href="/checkout" className={`btn-primary block w-full text-center ${!cart.readyToCheckout ? "pointer-events-none opacity-50" : ""}`}>
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}

export default function CartPage() {
  return <ShopChrome><CartBody /></ShopChrome>;
}
