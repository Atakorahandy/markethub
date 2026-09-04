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
import { parseStringArray } from "@/lib/json";

type WishlistRow = {
  id: string;
  product: {
    id: string; slug: string; name: string; price: number; discountPrice: number | null; images: string; stock: number; status: string;
    vendor: { businessName: string; slug: string; status: string };
  };
};

function WishlistBody() {
  const { me, loading: sessionLoading } = useSession();
  const { refresh: refreshCart } = useCart();
  const router = useRouter();
  const [items, setItems] = useState<WishlistRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: WishlistRow[] }>("/wishlist");
    setItems(res.items);
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/wishlist");
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id: string) {
    try {
      await api(`/wishlist/${id}`, { method: "DELETE" });
      toast("Removed from wishlist");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function moveToCart(row: WishlistRow) {
    try {
      await api("/cart", { method: "POST", body: { productId: row.product.id } });
      await api(`/wishlist/${row.id}`, { method: "DELETE" });
      await refreshCart();
      toast("Moved to cart");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  if (sessionLoading || !items) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">My wishlist</h1>
      {items.length === 0 ? (
        <EmptyState title="Your wishlist is empty" hint="Save products you're interested in for later." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => {
            const unavailable = row.product.status !== "active" || row.product.vendor.status !== "approved" || row.product.stock <= 0;
            const image = parseStringArray(row.product.images)[0];
            return (
              <div key={row.id} className="card flex gap-3 p-3">
                <Link href={`/product/${row.product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-black/5">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : <div className="grid h-full place-items-center text-lg">🛍️</div>}
                </Link>
                <div className="flex flex-1 flex-col">
                  <Link href={`/product/${row.product.slug}`} className="text-sm font-medium hover:underline">{row.product.name}</Link>
                  <p className="muted text-xs">{row.product.vendor.businessName}</p>
                  <p className="font-semibold text-brand-700">{formatMoney(row.product.discountPrice ?? row.product.price)}</p>
                  {unavailable && <p className="text-xs text-red-600">Unavailable</p>}
                  <div className="mt-auto flex gap-2 pt-1">
                    {!unavailable && <button onClick={() => moveToCart(row)} className="btn-primary btn-sm">Add to cart</button>}
                    <button onClick={() => remove(row.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WishlistPage() {
  return <ShopChrome><WishlistBody /></ShopChrome>;
}
