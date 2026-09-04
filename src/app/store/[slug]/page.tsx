"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { ProductCard, ProductCardData } from "@/components/product-card";
import { Spinner, EmptyState } from "@/components/ui";
import { api } from "@/lib/client";

type StoreDetail = {
  slug: string; businessName: string; description: string; logoUrl: string | null; bannerUrl: string | null;
  city: string; region: string; ratingAvg: number; ratingCount: number; _count: { products: number };
};

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreDetail | null | undefined>(undefined);
  const [products, setProducts] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    api<StoreDetail>(`/stores/${slug}`).then(setStore, () => setStore(null));
  }, [slug]);

  useEffect(() => {
    if (!store) return;
    api<{ items: ProductCardData[] }>(`/products?vendor=${slug}&pageSize=48`).then((r) => setProducts(r.items));
  }, [store, slug]);

  if (store === undefined) return <ShopChrome><div className="flex justify-center py-16"><Spinner /></div></ShopChrome>;
  if (!store) return <ShopChrome><p className="muted py-16 text-center">This store could not be found.</p></ShopChrome>;

  return (
    <ShopChrome>
      <div className="card mb-6 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-600 to-brand-800 sm:h-44">
          {store.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-2xl font-bold">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              store.businessName.charAt(0)
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{store.businessName}</h1>
            <p className="muted text-sm">{store.city}, {store.region} · {store._count.products} products</p>
            <p className="muted text-sm">{store.ratingCount > 0 ? `★ ${store.ratingAvg.toFixed(1)} (${store.ratingCount} reviews)` : "No reviews yet"}</p>
          </div>
        </div>
        {store.description && <p className="border-t border-[var(--border)] p-5 text-sm">{store.description}</p>}
      </div>

      {!products ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <EmptyState title="No products yet" hint="This store hasn't listed any products." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </ShopChrome>
  );
}
