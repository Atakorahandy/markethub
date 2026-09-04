"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ProductForm, emptyProductForm, formToPayload } from "@/components/product-form";

export default function NewProductPage() {
  const router = useRouter();
  const [value, setValue] = useState(emptyProductForm());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/vendor/products", { method: "POST", body: formToPayload(value) });
      router.push("/vendor/products");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="section-title">Add product</h1>
      <div className="card p-5">
        <ProductForm value={value} onChange={setValue} statusOptions={["draft", "active"]} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Create product"}</button>
    </form>
  );
}
