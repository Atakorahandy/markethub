"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type CouponRow = {
  id: string; code: string; type: string; value: number; minSubtotal: number; maxDiscount: number | null;
  startsAt: string | null; endsAt: string | null; usageLimit: number | null; perCustomerLimit: number | null; active: boolean;
};

export default function VendorCouponsPage() {
  const [items, setItems] = useState<CouponRow[] | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: CouponRow[] }>("/vendor/coupons");
    setItems(res.items);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/vendor/coupons", {
        method: "POST",
        body: {
          code, type, value: Number(value),
          minSubtotal: minSubtotal ? Number(minSubtotal) : 0,
          maxDiscount: type === "percent" && maxDiscount ? Number(maxDiscount) : undefined,
          usageLimit: usageLimit ? Number(usageLimit) : undefined,
          perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : undefined,
        },
      });
      toast("Coupon created");
      setCode(""); setValue(""); setMinSubtotal(""); setMaxDiscount(""); setUsageLimit("");
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await api(`/vendor/coupons/${id}`, { method: "PATCH", body: { active } });
      toast(active ? "Coupon reactivated" : "Coupon deactivated");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-6">
      {node}
      <h1 className="section-title">Coupons</h1>

      <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <label className="label">Code</label>
          <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}>
            <option value="percent">Percentage off</option>
            <option value="fixed">Fixed amount off (GHS)</option>
          </select>
        </div>
        <div>
          <label className="label">{type === "percent" ? "Percentage (1-100)" : "Amount off (GHS)"}</label>
          <input className="input" type="number" min={0} step={type === "percent" ? 1 : 0.01} value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div>
          <label className="label">Minimum spend (GHS, optional)</label>
          <input className="input" type="number" min={0} step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
        </div>
        {type === "percent" && (
          <div>
            <label className="label">Max discount cap (GHS, optional)</label>
            <input className="input" type="number" min={0} step="0.01" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Total uses allowed (optional)</label>
          <input className="input" type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
        </div>
        <div>
          <label className="label">Uses per customer (optional)</label>
          <input className="input" type="number" min={1} value={perCustomerLimit} onChange={(e) => setPerCustomerLimit(e.target.value)} placeholder="Unlimited" />
        </div>
        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "Creating…" : "Create coupon"}</button>
      </form>

      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="No coupons yet" /> : (
        <div className="grid gap-3">
          {items.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {c.code} <span className={`badge ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>{c.active ? "active" : "inactive"}</span>
                </p>
                <p className="muted text-xs">
                  {c.type === "percent" ? `${c.value}% off` : `${formatMoney(c.value)} off`}
                  {c.minSubtotal > 0 && ` · min spend ${formatMoney(c.minSubtotal)}`}
                  {c.maxDiscount != null && ` · capped at ${formatMoney(c.maxDiscount)}`}
                  {c.usageLimit != null && ` · ${c.usageLimit} total uses`}
                  {c.perCustomerLimit != null && ` · ${c.perCustomerLimit} per customer`}
                </p>
              </div>
              {c.active ? (
                <button onClick={() => toggle(c.id, false)} className="btn-danger btn-sm">Deactivate</button>
              ) : (
                <button onClick={() => toggle(c.id, true)} className="btn-ghost btn-sm">Reactivate</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
