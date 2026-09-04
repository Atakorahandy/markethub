"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShopChrome } from "@/components/shop-chrome";
import { ProductCard, ProductCardData } from "@/components/product-card";
import { api } from "@/lib/client";

type Category = { id: string; slug: string; name: string; imageUrl: string | null; parentId: string | null };

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [flashSales, setFlashSales] = useState<ProductCardData[]>([]);
  const [trending, setTrending] = useState<ProductCardData[]>([]);

  useEffect(() => {
    api<{ items: Category[] }>("/categories").then((r) => setCategories(r.items.filter((c) => !c.parentId).slice(0, 8)));
    api<{ items: ProductCardData[] }>("/products?sort=newest&pageSize=8").then((r) => setFeatured(r.items));
    api<{ items: ProductCardData[] }>("/flash-sales").then((r) => setFlashSales(r.items));
    api<{ items: ProductCardData[] }>("/products?sort=trending&pageSize=8").then((r) => setTrending(r.items));
  }, []);

  return (
    <ShopChrome>
      <section className="card flex flex-col items-center gap-4 px-6 py-16 text-center sm:py-24">
        <span className="badge bg-brand-100 text-brand-700">MarketHub Ghana</span>
        <h1 className="max-w-2xl text-3xl font-extrabold sm:text-5xl">Shop Everything. Delivered Simply.</h1>
        <p className="muted max-w-xl">
          MarketHub connects shoppers with independent vendors across Ghana — one storefront, many stores.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn-primary">Browse products</Link>
          <Link href="/register?role=vendor" className="btn-ghost">Sell on MarketHub</Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Shop by category</h2>
            <Link href="/categories" className="link text-sm">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="card flex items-center gap-2 p-3">
                <span className="text-xl">📦</span>
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {flashSales.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title text-red-600">⚡ Flash sales</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {flashSales.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">New arrivals</h2>
            <Link href="/products?sort=newest" className="link text-sm">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Trending now</h2>
            <Link href="/products?sort=trending" className="link text-sm">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {trending.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-bold">For shoppers</h2>
          <p className="muted mt-1 text-sm">Browse and buy from many vendors in one place. Cart and checkout launch in Phase 3.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">For vendors</h2>
          <p className="muted mt-1 text-sm">Register your store today. Once approved, list products and manage your storefront from your own dashboard.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">For delivery agents</h2>
          <p className="muted mt-1 text-sm">Apply to deliver for MarketHub. Verified agents get assigned deliveries and track earnings.</p>
        </div>
      </section>
    </ShopChrome>
  );
}
