"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type ProductOption = { id: string; name: string; price: number; discountPrice: number | null };
type FlashSaleRow = {
  id: string; salePrice: number; startsAt: string; endsAt: string; active: boolean;
  product: { name: string; slug: string; price: number; discountPrice: number | null };
};

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VendorFlashSalesPage() {
  const [items, setItems] = useState<FlashSaleRow[] | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [startsAt, setStartsAt] = useState(() => localInput(new Date(Date.now() + 5 * 60_000)));
  const [endsAt, setEndsAt] = useState(() => localInput(new Date(Date.now() + 26 * 60 * 60_000)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: FlashSaleRow[] }>("/vendor/flash-sales");
    setItems(res.items);
  }
  useEffect(() => {
    load();
    api<{ items: ProductOption[] }>("/vendor/products?pageSize=100").then((r) => setProducts(r.items));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/vendor/flash-sales", {
        method: "POST",
        body: { productId, salePrice: Number(salePrice), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() },
      });
      toast("Flash sale scheduled");
      setProductId(""); setSalePrice("");
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await api(`/vendor/flash-sales/${id}`, { method: "PATCH", body: { active } });
      toast(active ? "Flash sale reactivated" : "Flash sale cancelled");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  const selected = products.find((p) => p.id === productId);

  return (
    <div className="space-y-6">
      {node}
      <h1 className="section-title">Flash sales</h1>

      <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Product</label>
          <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.discountPrice ?? p.price)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Flash sale price (GHS){selected && ` — current: ${formatMoney(selected.discountPrice ?? selected.price)}`}</label>
          <input className="input" type="number" min={0} step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
        </div>
        <div />
        <div>
          <label className="label">Starts</label>
          <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </div>
        <div>
          <label className="label">Ends</label>
          <input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
        </div>
        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "Scheduling…" : "Schedule flash sale"}</button>
      </form>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No flash sales yet" /> : (
        <div className="grid gap-3">
          {items.map((f) => {
            const now = Date.now();
            const status = !f.active ? "cancelled" : now < new Date(f.startsAt).getTime() ? "upcoming" : now > new Date(f.endsAt).getTime() ? "ended" : "live";
            return (
              <div key={f.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {f.product.name}{" "}
                    <span className={`badge ${status === "live" ? "bg-emerald-100 text-emerald-800" : status === "upcoming" ? "bg-sky-100 text-sky-800" : "bg-zinc-200 text-zinc-700"}`}>{status}</span>
                  </p>
                  <p className="muted text-xs">
                    {formatMoney(f.salePrice)} (was {formatMoney(f.product.discountPrice ?? f.product.price)}) · {new Date(f.startsAt).toLocaleString()} → {new Date(f.endsAt).toLocaleString()}
                  </p>
                </div>
                {f.active ? (
                  <button onClick={() => toggle(f.id, false)} className="btn-danger btn-sm">Cancel</button>
                ) : (
                  <button onClick={() => toggle(f.id, true)} className="btn-ghost btn-sm">Reactivate</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
