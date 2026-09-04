"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { parseStringArray, parseStringRecord } from "@/lib/json";

type ProductDetail = {
  id: string; slug: string; name: string; description: string; shortDescription: string;
  price: number; discountPrice: number | null; stock: number; images: string; tags: string; specifications: string;
  ratingAvg: number; ratingCount: number;
  vendor: { businessName: string; slug: string; city: string; region: string; ratingAvg: number; ratingCount: number };
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  variants: { id: string; label: string; priceOverride: number | null; stock: number }[];
};

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductDetail | null | undefined>(undefined);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api<ProductDetail>(`/products/${slug}`).then(setProduct, () => setProduct(null));
  }, [slug]);

  if (product === undefined) {
    return <ShopChrome><div className="flex justify-center py-16"><Spinner /></div></ShopChrome>;
  }
  if (!product) {
    return <ShopChrome><p className="muted py-16 text-center">This product could not be found.</p></ShopChrome>;
  }

  const images = parseStringArray(product.images);
  const tags = parseStringArray(product.tags);
  const specs = parseStringRecord(product.specifications);
  const variant = product.variants.find((v) => v.id === selectedVariant);
  const effectivePrice = variant?.priceOverride ?? product.discountPrice ?? product.price;
  const effectiveStock = variant ? variant.stock : product.stock;
  const outOfStock = effectiveStock <= 0;

  return (
    <ShopChrome>
      <div className="mb-4 text-sm">
        <Link href="/products" className="link">All products</Link>
        <span className="muted"> / </span>
        <Link href={`/products?category=${product.category.slug}`} className="link">{product.category.name}</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="card mb-3 flex aspect-square items-center justify-center overflow-hidden bg-black/5">
            {images[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-5xl">🛍️</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button key={img} onClick={() => setActiveImage(i)} className={`h-16 w-16 overflow-hidden rounded-lg border ${i === activeImage ? "border-brand-600" : "border-[var(--border)]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            {product.brand && <p className="muted text-sm">{product.brand.name}</p>}
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="muted mt-1 text-sm">
              {product.ratingCount > 0 ? `★ ${product.ratingAvg.toFixed(1)} (${product.ratingCount} reviews)` : "No reviews yet"}
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-brand-700">{formatMoney(effectivePrice)}</span>
            {product.discountPrice != null && !variant && <span className="muted line-through">{formatMoney(product.price)}</span>}
          </div>

          <p className={outOfStock ? "text-sm font-medium text-red-600" : "text-sm font-medium text-emerald-600"}>
            {outOfStock ? "Out of stock" : `In stock (${effectiveStock} available)`}
          </p>

          {product.variants.length > 0 && (
            <div>
              <p className="label">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v.id === selectedVariant ? null : v.id)}
                    className={`chip ${v.id === selectedVariant ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="label m-0">Qty</label>
            <input type="number" min={1} max={Math.max(1, effectiveStock)} value={qty} disabled={outOfStock}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="input w-20" />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled title="Cart launches in Phase 3">Add to Cart</button>
            <button className="btn-ghost flex-1" disabled title="Cart launches in Phase 3">Buy Now</button>
          </div>
          <p className="muted text-xs">Cart and checkout launch in Phase 3 — browsing is fully live today.</p>

          <div className="card p-4">
            <p className="text-sm font-semibold">Sold by</p>
            <Link href={`/store/${product.vendor.slug}`} className="link font-medium">{product.vendor.businessName}</Link>
            <p className="muted text-xs">{product.vendor.city}, {product.vendor.region}</p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {product.description && (
          <div className="card p-5">
            <h2 className="section-title mb-2">Description</h2>
            <p className="whitespace-pre-line text-sm">{product.description}</p>
          </div>
        )}
        {Object.keys(specs).length > 0 && (
          <div className="card p-5">
            <h2 className="section-title mb-2">Specifications</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(specs).map(([k, v]) => (
                  <tr key={k}><td className="td pl-0 font-medium">{k}</td><td className="td">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ShopChrome>
  );
}
