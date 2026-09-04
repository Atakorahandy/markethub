"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { useCart } from "@/components/cart-context";
import { Spinner, useToast } from "@/components/ui";
import { ProductCard, ProductCardData } from "@/components/product-card";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { parseStringArray, parseStringRecord } from "@/lib/json";

type Review = { id: string; rating: number; title: string; body: string; vendorReply: string; vendorRepliedAt: string | null; createdAt: string; customer: { name: string } };

type ProductDetail = {
  id: string; slug: string; name: string; description: string; shortDescription: string;
  price: number; discountPrice: number | null; stock: number; images: string; tags: string; specifications: string;
  ratingAvg: number; ratingCount: number; activeFlashSalePrice: number | null;
  vendor: { businessName: string; slug: string; city: string; region: string; ratingAvg: number; ratingCount: number };
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  variants: { id: string; label: string; priceOverride: number | null; stock: number }[];
  reviews: Review[];
  related: ProductCardData[];
};

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{"★".repeat(Math.round(n))}{"☆".repeat(5 - Math.round(n))}</span>;
}

function ProductDetailBody() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { me } = useSession();
  const { refresh: refreshCart } = useCart();
  const { toast, node } = useToast();
  const [product, setProduct] = useState<ProductDetail | null | undefined>(undefined);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ProductDetail>(`/products/${slug}`).then(setProduct, () => setProduct(null));
  }, [slug]);

  if (product === undefined) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }
  if (!product) {
    return <p className="muted py-16 text-center">This product could not be found.</p>;
  }

  const images = parseStringArray(product.images);
  const tags = parseStringArray(product.tags);
  const specs = parseStringRecord(product.specifications);
  const variant = product.variants.find((v) => v.id === selectedVariant);
  const basePrice = variant?.priceOverride ?? product.discountPrice ?? product.price;
  const onFlashSale = product.activeFlashSalePrice != null && product.activeFlashSalePrice < basePrice;
  const effectivePrice = onFlashSale ? product.activeFlashSalePrice! : basePrice;
  const effectiveStock = variant ? variant.stock : product.stock;
  const outOfStock = effectiveStock <= 0;

  async function addToCart(): Promise<boolean> {
    if (!me?.user) {
      router.push(`/login?next=/product/${slug}`);
      return false;
    }
    setBusy(true);
    try {
      await api("/cart", { method: "POST", body: { productId: product!.id, variantId: variant?.id ?? null, quantity: qty } });
      await refreshCart();
      return true;
    } catch (e: any) {
      toast(e.message, "err");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToCart() {
    if (await addToCart()) toast("Added to cart");
  }

  async function handleBuyNow() {
    if (await addToCart()) router.push("/checkout");
  }

  async function addToWishlist() {
    if (!me?.user) {
      router.push(`/login?next=/product/${slug}`);
      return;
    }
    try {
      await api("/wishlist", { method: "POST", body: { productId: product!.id } });
      toast("Added to wishlist");
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  return (
    <>
      {node}
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

          {onFlashSale && <span className="badge w-fit bg-red-600 text-white">⚡ Flash sale price</span>}
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-bold ${onFlashSale ? "text-red-600" : "text-brand-700"}`}>{formatMoney(effectivePrice)}</span>
            {(onFlashSale || (product.discountPrice != null && !variant)) && <span className="muted line-through">{formatMoney(onFlashSale ? basePrice : product.price)}</span>}
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
                    onClick={() => { setSelectedVariant(v.id === selectedVariant ? null : v.id); setQty(1); }}
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
              onChange={(e) => setQty(Math.min(Math.max(1, Number(e.target.value)), Math.max(1, effectiveStock)))} className="input w-20" />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={outOfStock || busy} onClick={handleAddToCart}>Add to Cart</button>
            <button className="btn-ghost flex-1" disabled={outOfStock || busy} onClick={handleBuyNow}>Buy Now</button>
          </div>
          <button onClick={addToWishlist} className="link text-sm">♡ Save to wishlist</button>

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

      <div className="mt-10 card p-5">
        <h2 className="section-title mb-3">Reviews {product.ratingCount > 0 && <span className="muted text-sm font-normal">({product.ratingAvg.toFixed(1)} average, {product.ratingCount} review{product.ratingCount === 1 ? "" : "s"})</span>}</h2>
        {product.reviews.length === 0 ? (
          <p className="muted text-sm">No reviews yet — be the first to review this product after your order is delivered.</p>
        ) : (
          <div className="space-y-4">
            {product.reviews.map((r) => (
              <div key={r.id} className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.customer.name}</p>
                  <Stars n={r.rating} />
                </div>
                <p className="muted text-xs">{new Date(r.createdAt).toLocaleDateString()}</p>
                {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                {r.body && <p className="text-sm">{r.body}</p>}
                {r.vendorReply && (
                  <div className="mt-2 rounded-xl bg-black/5 p-3 text-sm">
                    <p className="font-medium">Seller reply</p>
                    <p>{r.vendorReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {product.related.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-3">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {product.related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      )}
    </>
  );
}

export default function ProductDetailPage() {
  return <ShopChrome><ProductDetailBody /></ShopChrome>;
}
