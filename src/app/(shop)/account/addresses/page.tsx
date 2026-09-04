"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { GHANA_REGIONS } from "@/lib/constants";

type Address = {
  id: string; label: string; recipientName: string; phone: string; region: string; city: string;
  area: string; streetLine: string; deliveryInstructions: string; isDefault: boolean;
};

const EMPTY = { label: "home", recipientName: "", phone: "", region: GHANA_REGIONS[0] as string, city: "", area: "", streetLine: "", deliveryInstructions: "", isDefault: false };

function AddressesBody() {
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Address[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: Address[] }>("/addresses");
    setItems(res.items);
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/account/addresses");
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(a?: Address) {
    if (a) {
      setEditingId(a.id);
      setForm({ label: a.label, recipientName: a.recipientName, phone: a.phone, region: a.region, city: a.city, area: a.area, streetLine: a.streetLine, deliveryInstructions: a.deliveryInstructions, isDefault: a.isDefault });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      if (editingId) await api(`/addresses/${editingId}`, { method: "PATCH", body: form });
      else await api("/addresses", { method: "POST", body: form });
      toast("Address saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this address?")) return;
    try {
      await api(`/addresses/${id}`, { method: "DELETE" });
      toast("Address deleted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  if (sessionLoading || !items) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">My addresses</h1>
        {!form && <button onClick={() => startEdit()} className="btn-primary btn-sm">Add address</button>}
      </div>

      {form && (
        <form onSubmit={save} className="card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Label</label>
              <select className="select" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}>
                <option value="home">Home</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Recipient name</label>
              <input className="input" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="024xxxxxxx" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </div>
            <div>
              <label className="label">Region</label>
              <select className="select" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Area / neighbourhood</label>
            <input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </div>
          <div>
            <label className="label">Street address</label>
            <input className="input" value={form.streetLine} onChange={(e) => setForm({ ...form, streetLine: e.target.value })} />
          </div>
          <div>
            <label className="label">Delivery instructions (optional)</label>
            <textarea className="input" rows={2} value={form.deliveryInstructions} onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default address
          </label>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {items.length === 0 && !form ? (
        <EmptyState title="No saved addresses" hint="Add a delivery address to speed up checkout." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="card flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold capitalize">{a.label} {a.isDefault && <span className="badge bg-brand-100 text-brand-700">Default</span>}</p>
                <p className="text-sm">{a.recipientName} · {a.phone}</p>
                <p className="muted text-sm">{a.streetLine}{a.streetLine && ", "}{a.area}{a.area && ", "}{a.city}, {a.region}</p>
              </div>
              <div className="flex shrink-0 gap-3 text-xs">
                <button onClick={() => startEdit(a)} className="link">Edit</button>
                <button onClick={() => remove(a.id)} className="text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddressesPage() {
  return <ShopChrome><AddressesBody /></ShopChrome>;
}
