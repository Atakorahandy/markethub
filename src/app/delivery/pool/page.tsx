"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type PoolItem = {
  id: string; agentEarning: number;
  vendorOrder: {
    vendor: { businessName: string; city: string; region: string };
    order: { orderNumber: string; city: string; region: string };
    items: { quantity: number }[];
  };
};

export default function DeliveryPoolPage() {
  const [items, setItems] = useState<PoolItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast, node } = useToast();
  const router = useRouter();

  async function load() {
    const res = await api<{ items: PoolItem[] }>("/delivery/pool");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function accept(id: string) {
    setBusyId(id);
    try {
      await api(`/delivery/deliveries/${id}/accept`, { method: "POST" });
      toast("Delivery accepted");
      router.push(`/delivery/deliveries/${id}`);
    } catch (e: any) {
      toast(e.message, "err");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Available jobs</h1>

      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="No jobs available right now" hint="Make sure you're online — check your dashboard. New jobs appear here as vendors ship orders." />
      ) : (
        <div className="grid gap-3">
          {items.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{d.vendorOrder.order.orderNumber}</p>
                <p className="muted text-sm">Pick up: {d.vendorOrder.vendor.businessName} — {d.vendorOrder.vendor.city}, {d.vendorOrder.vendor.region}</p>
                <p className="muted text-sm">Deliver to: {d.vendorOrder.order.city}, {d.vendorOrder.order.region}</p>
                <p className="muted text-xs">{d.vendorOrder.items.reduce((s, i) => s + i.quantity, 0)} item(s) · earn {formatMoney(d.agentEarning)}</p>
              </div>
              <button onClick={() => accept(d.id)} disabled={busyId === d.id} className="btn-primary btn-sm">
                {busyId === d.id ? "Accepting…" : "Accept"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
