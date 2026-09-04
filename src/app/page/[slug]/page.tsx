"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";

type CmsContent = { title: string; content: string };

export default function CmsPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CmsContent | null | undefined>(undefined);

  useEffect(() => {
    api<CmsContent>(`/cms/${slug}`).then(setPage, () => setPage(null));
  }, [slug]);

  return (
    <ShopChrome>
      {page === undefined ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !page ? (
        <p className="muted py-16 text-center">This page could not be found.</p>
      ) : (
        <article className="mx-auto max-w-2xl space-y-4">
          <h1 className="section-title">{page.title}</h1>
          {page.content.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line leading-relaxed">{para}</p>
          ))}
        </article>
      )}
    </ShopChrome>
  );
}
