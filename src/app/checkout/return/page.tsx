"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { SessionProvider } from "@/components/session";

function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref");
  const [msg, setMsg] = useState("Confirming your payment…");

  useEffect(() => {
    if (!ref) { router.replace("/orders"); return; }
    api<{ status: string; orderNumber: string }>("/payments/verify", { body: { reference: ref } })
      .then((r) => {
        if (r.status !== "SUCCESSFUL") setMsg("Almost there — confirming your payment…");
        router.replace(`/orders/${r.orderNumber}`);
      })
      .catch(() => setMsg("We couldn't confirm the payment. Check your orders in a moment."));
  }, [ref, router]);

  return <div className="grid min-h-screen place-items-center p-6"><p className="muted">{msg}</p></div>;
}

export default function CheckoutReturnPage() {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <ReturnInner />
      </Suspense>
    </SessionProvider>
  );
}
