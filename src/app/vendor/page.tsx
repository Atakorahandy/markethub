"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, StatusBadge } from "@/components/ui";
import { Metric } from "@/components/console-shell";
import { VENDOR_STATUS_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

type VendorSummary = { id: string; businessName: string; slug: string; status: string; rejectionNote: string; city: string; region: string };

export default function VendorDashboard() {
  const [vendor, setVendor] = useState<VendorSummary | null | undefined>(undefined);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    api<VendorSummary>("/vendor/me").then(setVendor, () => setVendor(null));
  }, []);

  useEffect(() => {
    if (vendor?.status !== "approved") return;
    api<{ total: number }>("/vendor/products?pageSize=1").then((r) => setProductCount(r.total));
    api<{ total: number }>("/vendor/orders?status=paid&pageSize=1").then((r) => setPendingOrders(r.total));
    api<{ balance: number }>("/vendor/wallet").then((r) => setBalance(r.balance));
  }, [vendor]);

  if (vendor === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="section-title">Vendor dashboard</h1>
      {vendor ? (
        <>
          <div className="card space-y-2 p-5">
            <p className="font-semibold">{vendor.businessName} <StatusBadge status={vendor.status} /></p>
            <p className="muted text-sm">{VENDOR_STATUS_LABEL[vendor.status] ?? vendor.status} · {vendor.city}, {vendor.region}</p>
            {vendor.status === "rejected" && vendor.rejectionNote && (
              <p className="text-sm text-red-600">Reason: {vendor.rejectionNote}</p>
            )}
            {vendor.status !== "approved" && (
              <p className="muted text-sm">
                Product listings and your storefront unlock once an administrator approves your store.
              </p>
            )}
          </div>

          {vendor.status === "approved" && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Products" value={productCount ?? "…"} />
                <Metric label="New orders" value={pendingOrders ?? "…"} sub="awaiting fulfilment" />
                <Metric label="Wallet balance" value={balance != null ? formatMoney(balance) : "…"} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/vendor/orders" className="btn-primary btn-sm">View orders</Link>
                <Link href="/vendor/products" className="btn-ghost btn-sm">Manage products</Link>
                <Link href="/vendor/wallet" className="btn-ghost btn-sm">Wallet</Link>
                <Link href={`/store/${vendor.slug}`} className="btn-ghost btn-sm">View storefront</Link>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="muted">We couldn&apos;t load your store profile.</p>
      )}
    </div>
  );
}
