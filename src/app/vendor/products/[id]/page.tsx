"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner, useToast } from "@/components/ui";
import { ProductForm, ProductFormValues, productToForm, formToPayload } from "@/components/product-form";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [value, setValue] = useState<ProductFormValues | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    api(`/vendor/products/${id}`).then(
      (p: any) => { setValue(productToForm(p)); setModerationNote(p.moderationNote ?? ""); },
      () => setErr("Could not load this product."),
    );
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setErr("");
    setBusy(true);
    try {
      await api(`/vendor/products/${id}`, { method: "PATCH", body: formToPayload(value) });
      toast("Product saved");
      router.push("/vendor/products");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (!value) return err ? <p className="text-red-600">{err}</p> : <Spinner />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      {node}
      <h1 className="section-title">Edit product</h1>
      {moderationNote && (value.status === "rejected" || value.status === "suspended") && (
        <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Note from our team</p>
          <p>{moderationNote}</p>
        </div>
      )}
      <div className="card p-5">
        <ProductForm
          value={value}
          onChange={setValue}
          statusOptions={Array.from(new Set([value.status, "draft", "pending_review", "out_of_stock"])) as ProductFormValues["status"][]}
        />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
