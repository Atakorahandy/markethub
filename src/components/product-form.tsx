"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { toCedis } from "@/lib/money";

type Category = { id: string; slug: string; name: string; parentId: string | null };
type Brand = { id: string; slug: string; name: string };

export type ProductFormValues = {
  name: string;
  categoryId: string;
  brandId: string;
  sku: string;
  shortDescription: string;
  description: string;
  price: string;
  discountPrice: string;
  stock: string;
  lowStockThreshold: string;
  images: string; // newline-separated URLs in the form, converted to array on submit
  tags: string; // comma-separated
  status: "draft" | "pending_review" | "active" | "rejected" | "out_of_stock" | "suspended";
};

const EMPTY: ProductFormValues = {
  name: "", categoryId: "", brandId: "", sku: "", shortDescription: "", description: "",
  price: "", discountPrice: "", stock: "0", lowStockThreshold: "5", images: "", tags: "", status: "pending_review",
};

export function emptyProductForm(): ProductFormValues {
  return { ...EMPTY };
}

export function productToForm(p: any): ProductFormValues {
  return {
    name: p.name, categoryId: p.categoryId, brandId: p.brandId ?? "", sku: p.sku ?? "",
    shortDescription: p.shortDescription ?? "", description: p.description ?? "",
    price: String(toCedis(p.price)), discountPrice: p.discountPrice != null ? String(toCedis(p.discountPrice)) : "",
    stock: String(p.stock), lowStockThreshold: String(p.lowStockThreshold),
    images: (JSON.parse(p.images ?? "[]") as string[]).join("\n"),
    tags: (JSON.parse(p.tags ?? "[]") as string[]).join(", "),
    status: p.status,
  };
}

export function formToPayload(v: ProductFormValues) {
  return {
    name: v.name,
    categoryId: v.categoryId,
    brandId: v.brandId || null,
    sku: v.sku || undefined,
    shortDescription: v.shortDescription || undefined,
    description: v.description || undefined,
    price: Number(v.price),
    discountPrice: v.discountPrice ? Number(v.discountPrice) : null,
    stock: Number(v.stock),
    lowStockThreshold: Number(v.lowStockThreshold),
    images: v.images.split("\n").map((s) => s.trim()).filter(Boolean),
    tags: v.tags.split(",").map((s) => s.trim()).filter(Boolean),
    status: v.status,
  };
}

export function ProductForm({
  value, onChange, statusOptions,
}: {
  value: ProductFormValues;
  onChange: (v: ProductFormValues) => void;
  statusOptions: ProductFormValues["status"][];
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    api<{ items: Category[] }>("/categories").then((r) => setCategories(r.items));
    api<{ items: Brand[] }>("/brands").then((r) => setBrands(r.items));
  }, []);

  const set = <K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) => onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Product name</label>
        <input className="input" value={value.name} onChange={(e) => set("name", e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="select" value={value.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Brand (optional)</label>
          <select className="select" value={value.brandId} onChange={(e) => set("brandId", e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Short description</label>
        <input className="input" maxLength={300} value={value.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
      </div>
      <div>
        <label className="label">Full description</label>
        <textarea className="input" rows={4} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Price (GHS)</label>
          <input className="input" type="number" min={0} step="0.01" value={value.price} onChange={(e) => set("price", e.target.value)} required />
        </div>
        <div>
          <label className="label">Discount price (GHS, optional)</label>
          <input className="input" type="number" min={0} step="0.01" value={value.discountPrice} onChange={(e) => set("discountPrice", e.target.value)} />
        </div>
        <div>
          <label className="label">Stock quantity</label>
          <input className="input" type="number" min={0} value={value.stock} onChange={(e) => set("stock", e.target.value)} required />
        </div>
        <div>
          <label className="label">Low-stock threshold</label>
          <input className="input" type="number" min={0} value={value.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">SKU (optional)</label>
        <input className="input" value={value.sku} onChange={(e) => set("sku", e.target.value)} />
      </div>

      <div>
        <label className="label">Image URLs (one per line)</label>
        <textarea className="input" rows={3} placeholder="https://images.unsplash.com/..." value={value.images} onChange={(e) => set("images", e.target.value)} />
        <p className="muted mt-1 text-xs">Object storage upload (Cloudinary/S3) is a later phase — paste hosted image URLs for now.</p>
      </div>

      <div>
        <label className="label">Tags (comma-separated)</label>
        <input className="input" value={value.tags} onChange={(e) => set("tags", e.target.value)} />
      </div>

      <div>
        <label className="label">Status</label>
        <select className="select" value={value.status} onChange={(e) => set("status", e.target.value as ProductFormValues["status"])}>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        {statusOptions.includes("pending_review") && (
          <p className="muted mt-1 text-xs">A product only appears in the marketplace once our team approves it — submit for review when it's ready.</p>
        )}
      </div>
    </div>
  );
}
