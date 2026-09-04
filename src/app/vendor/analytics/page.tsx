"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";
import { Metric } from "@/components/console-shell";
import { formatMoney } from "@/lib/money";

type Summary = {
  revenue: number; orderCount: number; avgOrderValue: number;
  dailyRevenue: { date: string; amount: number; count: number }[];
  topProducts: { productId: string; name: string; quantity: number }[];
  orderStatusBreakdown: { status: string; count: number }[];
};

const RANGES = [{ label: "Last 7 days", days: 7 }, { label: "Last 30 days", days: 30 }, { label: "Last 90 days", days: 90 }] as const;

export default function VendorAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    api<Summary>(`/vendor/analytics/summary?from=${from}`).then(setSummary);
  }, [days]);

  if (!summary) return <Spinner />;

  const maxDaily = Math.max(1, ...summary.dailyRevenue.map((d) => d.amount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="section-title">Analytics</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === r.days ? "bg-brand-600 text-white" : "bg-black/5"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Revenue" value={formatMoney(summary.revenue)} />
        <Metric label="Orders" value={summary.orderCount} />
        <Metric label="Average order value" value={formatMoney(summary.avgOrderValue)} />
      </div>

      <div className="card p-5">
        <p className="mb-3 font-semibold">Daily revenue</p>
        {summary.dailyRevenue.length === 0 ? (
          <p className="muted text-sm">No orders in this range.</p>
        ) : (
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {summary.dailyRevenue.map((d) => (
              <div key={d.date} className="flex h-full min-w-[10px] flex-1 flex-col justify-end gap-1" title={`${d.date}: ${formatMoney(d.amount)} (${d.count} order${d.count === 1 ? "" : "s"})`}>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(4, (d.amount / maxDaily) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="mb-3 font-semibold">Top products</p>
          {summary.topProducts.length === 0 ? <p className="muted text-sm">No orders in this range.</p> : (
            <div className="space-y-2">
              {summary.topProducts.map((p) => (
                <div key={p.productId} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-medium">{p.quantity} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="mb-3 font-semibold">Order status breakdown</p>
          <div className="flex flex-wrap gap-4">
            {summary.orderStatusBreakdown.map((s) => (
              <div key={s.status} className="text-sm">
                <span className="capitalize muted">{s.status.replace(/_/g, " ")}</span>: <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
