"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type ProductRow = {
  id: string; name: string; price: number; discountPrice: number | null; stock: number; status: string;
  category: { name: string }; brand: { name: string } | null;
};

export default function VendorProductsPage() {
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ items: ProductRow[] }>("/vendor/products");
    setItems(res.items);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await api(`/vendor/products/${id}`, { method: "DELETE" });
      toast("Product deleted");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex items-center justify-between">
        <h1 className="section-title">Products</h1>
        <Link href="/vendor/products/new" className="btn-primary btn-sm">Add product</Link>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="No products yet" hint="Add your first product to start selling." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Status</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td">{p.category.name}{p.brand ? ` · ${p.brand.name}` : ""}</td>
                  <td className="td">{formatMoney(p.discountPrice ?? p.price)}</td>
                  <td className="td">{p.stock}</td>
                  <td className="td"><StatusBadge status={p.status} /></td>
                  <td className="td text-right">
                    <Link href={`/vendor/products/${p.id}`} className="link mr-3 text-xs">Edit</Link>
                    <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
