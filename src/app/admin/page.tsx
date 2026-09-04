"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Metric } from "@/components/console-shell";
import { Spinner } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type Counts = {
  users?: number;
  vendorsPending?: number;
  vendorsApproved?: number;
  deliveryAgentsPending?: number;
  productsPendingReview?: number;
  withdrawalsPending?: number;
  revenue30d?: number;
  orders30d?: number;
};

/** Each card's own data comes from an endpoint gated on a different
 *  permission — a role missing one (e.g. support_agent can't see products)
 *  should still see every card it *can* see, not a broken page. */
export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    (async () => {
      const settled = await Promise.allSettled([
        api<{ total: number }>("/admin/users?pageSize=1"),
        api<{ total: number }>("/admin/vendors?status=pending&pageSize=1"),
        api<{ total: number }>("/admin/vendors?status=approved&pageSize=1"),
        api<{ total: number }>("/admin/delivery-agents?verification=pending&pageSize=1"),
        api<{ total: number }>("/admin/products?status=pending_review&pageSize=1"),
        api<{ items: unknown[] }>("/admin/withdrawals?status=pending"),
        api<{ revenue: number; orderCount: number }>("/admin/reports/summary"),
      ]);
      const val = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? r.value : undefined);
      const [users, vendorsPending, vendorsApproved, agentsPending, productsPending, withdrawalsPending, report] = settled.map(val) as any[];
      setCounts({
        users: users?.total,
        vendorsPending: vendorsPending?.total,
        vendorsApproved: vendorsApproved?.total,
        deliveryAgentsPending: agentsPending?.total,
        productsPendingReview: productsPending?.total,
        withdrawalsPending: withdrawalsPending?.items?.length,
        revenue30d: report?.revenue,
        orders30d: report?.orderCount,
      });
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="section-title">Dashboard</h1>
      {!counts ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.revenue30d !== undefined && <Metric label="Revenue (30d)" value={formatMoney(counts.revenue30d)} />}
          {counts.orders30d !== undefined && <Metric label="Paid orders (30d)" value={counts.orders30d} />}
          {counts.users !== undefined && <Metric label="Total users" value={counts.users} />}
          {counts.vendorsApproved !== undefined && <Metric label="Approved vendors" value={counts.vendorsApproved} />}
          {counts.vendorsPending !== undefined && <Metric label="Vendors pending review" value={counts.vendorsPending} sub={counts.vendorsPending ? "needs attention" : undefined} />}
          {counts.productsPendingReview !== undefined && <Metric label="Products pending review" value={counts.productsPendingReview} sub={counts.productsPendingReview ? "needs attention" : undefined} />}
          {counts.deliveryAgentsPending !== undefined && <Metric label="Delivery agents pending" value={counts.deliveryAgentsPending} sub={counts.deliveryAgentsPending ? "needs attention" : undefined} />}
          {counts.withdrawalsPending !== undefined && <Metric label="Withdrawals pending" value={counts.withdrawalsPending} sub={counts.withdrawalsPending ? "needs attention" : undefined} />}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {counts?.vendorsPending ? <Link href="/admin/vendors" className="link">Review pending vendors →</Link> : null}
        {counts?.productsPendingReview ? <Link href="/admin/products" className="link">Review pending products →</Link> : null}
        {counts?.withdrawalsPending ? <Link href="/admin/withdrawals" className="link">Review pending withdrawals →</Link> : null}
        <Link href="/admin/reports" className="link">Full reports →</Link>
      </div>
    </div>
  );
}
