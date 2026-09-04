"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Metric } from "@/components/console-shell";
import { Spinner } from "@/components/ui";

type Counts = { users: number; vendorsPending: number; vendorsApproved: number; deliveryAgentsPending: number };

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    (async () => {
      const [users, vendorsPending, vendorsApproved, agentsPending] = await Promise.all([
        api<{ total: number }>("/admin/users?pageSize=1"),
        api<{ total: number }>("/admin/vendors?status=pending&pageSize=1"),
        api<{ total: number }>("/admin/vendors?status=approved&pageSize=1"),
        api<{ total: number }>("/admin/delivery-agents?verification=pending&pageSize=1"),
      ]);
      setCounts({ users: users.total, vendorsPending: vendorsPending.total, vendorsApproved: vendorsApproved.total, deliveryAgentsPending: agentsPending.total });
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="section-title">Dashboard</h1>
      {!counts ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Total users" value={counts.users} />
          <Metric label="Vendors pending review" value={counts.vendorsPending} />
          <Metric label="Approved vendors" value={counts.vendorsApproved} />
          <Metric label="Delivery agents pending" value={counts.deliveryAgentsPending} />
        </div>
      )}
      <p className="muted text-sm">
        Catalog, orders, payments, and reporting dashboards arrive in later phases. This foundation
        release covers identity, roles, and onboarding moderation.
      </p>
    </div>
  );
}
