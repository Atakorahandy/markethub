"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type OrderRow = {
  id: string; orderNumber: string; total: number; status: string; createdAt: string;
  vendorOrders: { items: { nameSnapshot: string; quantity: number }[] }[];
};

function OrdersBody() {
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/orders");
    if (me?.user) api<{ items: OrderRow[] }>("/orders").then((r) => setItems(r.items));
  }, [sessionLoading, me, router]);

  if (sessionLoading || !items) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="section-title">My orders</h1>
      {items.length === 0 ? (
        <EmptyState title="No orders yet" hint="Your placed orders will show up here." />
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const itemCount = o.vendorOrders.reduce((sum, vo) => sum + vo.items.reduce((s, i) => s + i.quantity, 0), 0);
            return (
              <Link key={o.id} href={`/orders/${o.orderNumber}`} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{o.orderNumber} <StatusBadge status={o.status} /></p>
                  <p className="muted text-xs">{new Date(o.createdAt).toLocaleDateString()} · {itemCount} item{itemCount === 1 ? "" : "s"}</p>
                </div>
                <p className="font-semibold text-brand-700">{formatMoney(o.total)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <ShopChrome><OrdersBody /></ShopChrome>;
}
