"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SessionProvider } from "@/components/session";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type OrderSummary = { orderNumber: string; total: number; vendorOrders: { vendor: { businessName: string } }[] };

function MockPayBody() {
  const { reference: rawRef } = useParams<{ reference: string }>();
  const reference = decodeURIComponent(rawRef);
  const router = useRouter();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Payment references embed the order number: MH-XXXXXX-yyyyyy
    const num = reference.split("-").slice(0, 2).join("-");
    api<OrderSummary>(`/orders/${num}`).then(setOrder).catch(() => {});
  }, [reference]);

  async function settle(outcome: "success" | "fail") {
    setBusy(true);
    try {
      const res = await api<{ orderNumber: string }>("/payments/mock-settle", { body: { reference, outcome } });
      router.push(`/orders/${res.orderNumber}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <div className="card p-6 text-center">
        <span className="badge bg-amber-100 text-amber-800">MOCK GATEWAY — no real charge</span>
        <h1 className="mt-3 text-lg font-bold">Confirm payment</h1>
        {order && (
          <>
            <p className="muted mt-1 text-sm">Order {order.orderNumber} · {order.vendorOrders.map((v) => v.vendor.businessName).join(", ")}</p>
            <p className="mt-3 text-3xl font-extrabold">{formatMoney(order.total)}</p>
          </>
        )}
        <p className="muted mt-1 text-xs">Ref: {reference}</p>
        <div className="mt-6 space-y-2">
          <button onClick={() => settle("success")} disabled={busy} className="btn-primary w-full">Approve payment</button>
          <button onClick={() => settle("fail")} disabled={busy} className="btn-ghost w-full">Simulate failure</button>
        </div>
        <p className="muted mt-4 text-xs">
          This screen stands in for a Paystack card / Mobile Money checkout page. Approving fires a
          signed webhook through the same server-side verification path a real gateway uses.
        </p>
      </div>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <SessionProvider>
      <MockPayBody />
    </SessionProvider>
  );
}
