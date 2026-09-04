"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShopChrome } from "@/components/shop-chrome";
import { Spinner, EmptyState } from "@/components/ui";
import { api } from "@/lib/client";

type Category = { id: string; slug: string; name: string; imageUrl: string | null; parentId: string | null };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    api<{ items: Category[] }>("/categories").then((r) => setCategories(r.items));
  }, []);

  const top = categories?.filter((c) => !c.parentId) ?? [];
  const childrenOf = (id: string) => categories?.filter((c) => c.parentId === id) ?? [];

  return (
    <ShopChrome>
      <h1 className="section-title mb-4">Categories</h1>
      {!categories ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : top.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((c) => (
            <div key={c.id} className="card p-4">
              <Link href={`/products?category=${c.slug}`} className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black/5 text-xl">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : "📦"}
                </div>
                <span className="font-semibold">{c.name}</span>
              </Link>
              {childrenOf(c.id).length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
                  {childrenOf(c.id).map((sub) => (
                    <li key={sub.id}>
                      <Link href={`/products?category=${sub.slug}`} className="link text-sm">{sub.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </ShopChrome>
  );
}
