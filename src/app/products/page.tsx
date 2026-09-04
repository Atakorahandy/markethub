"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { ProductCard, ProductCardData } from "@/components/product-card";
import { Spinner, EmptyState } from "@/components/ui";
import { api } from "@/lib/client";

type Category = { id: string; slug: string; name: string; parentId: string | null };
type Brand = { id: string; slug: string; name: string };

const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "Newest" },
  { key: "trending", label: "Trending" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

function ProductsBody() {
  const router = useRouter();
  const params = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [total, setTotal] = useState(0);

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const sort = params.get("sort") ?? "relevance";
  const page = Number(params.get("page") ?? "1");
  const pageSize = 24;

  useEffect(() => {
    api<{ items: Category[] }>("/categories").then((r) => setCategories(r.items));
    api<{ items: Brand[] }>("/brands").then((r) => setBrands(r.items));
  }, []);

  useEffect(() => {
    setItems(null);
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (category) qs.set("category", category);
    if (brand) qs.set("brand", brand);
    if (minPrice) qs.set("minPrice", minPrice);
    if (maxPrice) qs.set("maxPrice", maxPrice);
    if (sort !== "relevance") qs.set("sort", sort);
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    api<{ items: ProductCardData[]; total: number }>(`/products?${qs.toString()}`).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  }, [q, category, brand, minPrice, maxPrice, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateParam(key: string, value: string) {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value); else qs.delete(key);
    if (key !== "page") qs.delete("page");
    router.push(`/products?${qs.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-5">
        <div>
          <p className="label">Search</p>
          <input
            className="input"
            defaultValue={q}
            placeholder="Search products…"
            onKeyDown={(e) => e.key === "Enter" && updateParam("q", (e.target as HTMLInputElement).value)}
          />
        </div>
        <div>
          <p className="label">Category</p>
          <select className="select" value={category} onChange={(e) => updateParam("category", e.target.value)}>
            <option value="">All categories</option>
            {categories.filter((c) => !c.parentId).map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="label">Brand</p>
          <select className="select" value={brand} onChange={(e) => updateParam("brand", e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <p className="label">Price range (GHS)</p>
          <div className="flex gap-2">
            <input className="input" type="number" min={0} placeholder="Min" defaultValue={minPrice}
              onKeyDown={(e) => e.key === "Enter" && updateParam("minPrice", (e.target as HTMLInputElement).value)} />
            <input className="input" type="number" min={0} placeholder="Max" defaultValue={maxPrice}
              onKeyDown={(e) => e.key === "Enter" && updateParam("maxPrice", (e.target as HTMLInputElement).value)} />
          </div>
        </div>
      </aside>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="muted text-sm">{items ? `${total} product${total === 1 ? "" : "s"}` : "Loading…"}</p>
          <select className="select w-auto" value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {!items ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No products match your filters" hint="Try a broader search or clear a filter." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Previous</button>
                <span className="muted text-sm">Page {page} of {totalPages}</span>
                <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ShopChrome>
      <Suspense fallback={<div className="flex justify-center py-16"><Spinner /></div>}>
        <ProductsBody />
      </Suspense>
    </ShopChrome>
  );
}
