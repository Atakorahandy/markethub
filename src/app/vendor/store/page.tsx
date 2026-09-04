"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, useToast, StatusBadge } from "@/components/ui";

type VendorStore = {
  id: string; businessName: string; slug: string; status: string; description: string;
  logoUrl: string | null; bannerUrl: string | null; city: string; region: string;
};

export default function VendorStorePage() {
  const [store, setStore] = useState<VendorStore | null | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    api<VendorStore>("/vendor/me").then((v) => {
      setStore(v);
      setDescription(v.description);
      setLogoUrl(v.logoUrl ?? "");
      setBannerUrl(v.bannerUrl ?? "");
    }, () => setStore(null));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/vendor/me", { method: "PATCH", body: { description, logoUrl: logoUrl || null, bannerUrl: bannerUrl || null } });
      toast("Store profile saved");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (store === undefined) return <Spinner />;
  if (!store) return <p className="muted">We couldn&apos;t load your store profile.</p>;

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-4">
      {node}
      <h1 className="section-title">Store settings</h1>
      <div className="card space-y-4 p-5">
        <div>
          <p className="label">Store name</p>
          <p className="font-semibold">{store.businessName} <StatusBadge status={store.status} /></p>
          <p className="muted text-xs">markethub.app/store/{store.slug}</p>
        </div>
        {store.status !== "approved" && (
          <p className="muted text-sm">Your storefront is only visible to shoppers once an administrator approves it.</p>
        )}
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Banner URL</label>
          <input className="input" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
