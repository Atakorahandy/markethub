"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";

function AccountBody() {
  const { me, loading, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me?.user) router.replace("/login?next=/account");
  }, [loading, me, router]);

  if (loading || !me?.user) return <p className="muted p-16 text-center">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="section-title">My account</h1>
      <div className="card space-y-3 p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="muted text-xs">Name</p><p className="font-medium">{me.user.name}</p></div>
          <div><p className="muted text-xs">Email</p><p className="font-medium">{me.user.email}</p></div>
          <div><p className="muted text-xs">Phone</p><p className="font-medium">{me.user.phone ?? "—"}</p></div>
          <div><p className="muted text-xs">Account type</p><p className="font-medium capitalize">{me.user.kind.replace("_", " ")}</p></div>
        </div>
        <button onClick={logout} className="btn-danger btn-sm">Sign out</button>
      </div>

      {me.vendorIds.length > 0 && (
        <a href="/vendor" className="card block p-5 hover:border-brand-500">
          <p className="font-semibold">Go to your vendor dashboard →</p>
        </a>
      )}
      {me.deliveryAgentId && (
        <a href="/delivery" className="card block p-5 hover:border-brand-500">
          <p className="font-semibold">Go to your delivery agent dashboard →</p>
        </a>
      )}
      {(me.isSuperAdmin || me.isPlatformStaff) && (
        <a href="/admin" className="card block p-5 hover:border-brand-500">
          <p className="font-semibold">Go to the admin console →</p>
        </a>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <ShopChrome>
      <AccountBody />
    </ShopChrome>
  );
}
