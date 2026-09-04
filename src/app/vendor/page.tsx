"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, StatusBadge } from "@/components/ui";
import { VENDOR_STATUS_LABEL } from "@/lib/constants";

type VendorSummary = { id: string; businessName: string; status: string; rejectionNote: string; city: string; region: string };

export default function VendorDashboard() {
  const [vendor, setVendor] = useState<VendorSummary | null | undefined>(undefined);

  useEffect(() => {
    api<VendorSummary>("/vendor/me").then(setVendor, () => setVendor(null));
  }, []);

  if (vendor === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="section-title">Vendor dashboard</h1>
      {vendor ? (
        <div className="card space-y-2 p-5">
          <p className="font-semibold">{vendor.businessName} <StatusBadge status={vendor.status} /></p>
          <p className="muted text-sm">{VENDOR_STATUS_LABEL[vendor.status] ?? vendor.status} · {vendor.city}, {vendor.region}</p>
          {vendor.status === "rejected" && vendor.rejectionNote && (
            <p className="text-sm text-red-600">Reason: {vendor.rejectionNote}</p>
          )}
          {vendor.status !== "approved" && (
            <p className="muted text-sm">
              Product listings, orders and your wallet unlock once an administrator approves your store.
            </p>
          )}
        </div>
      ) : (
        <p className="muted">We couldn&apos;t load your store profile.</p>
      )}
    </div>
  );
}
