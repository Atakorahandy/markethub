"use client";

import { useEffect, useState } from "react";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  under_review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-zinc-200 text-zinc-700",
  offline: "bg-zinc-200 text-zinc-700",
  online: "bg-emerald-100 text-emerald-800",
  on_delivery: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  draft: "bg-zinc-200 text-zinc-700",
  out_of_stock: "bg-amber-100 text-amber-800",
  pending_payment: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "bg-zinc-100 text-zinc-700";
  return <span className={`badge ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className={`fixed inset-x-0 bottom-20 z-50 mx-auto w-fit max-w-[92vw] rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${msg.tone === "ok" ? "bg-zinc-900" : "bg-red-600"}`}>
      {msg.text}
    </div>
  ) : null;
  return { toast: (text: string, tone: "ok" | "err" = "ok") => setMsg({ text, tone }), node };
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}
