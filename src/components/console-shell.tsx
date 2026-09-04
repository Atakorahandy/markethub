"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SessionProvider, useSession } from "./session";

export type NavItem = { href: string; label: string };

function Shell({ title, badge, nav, children }: { title: string; badge: string; nav: NavItem[]; children: React.ReactNode }) {
  const path = usePathname();
  const { me, loading, logout } = useSession();

  useEffect(() => {
    if (!loading && !me?.user) window.location.href = `/login?next=${path}`;
  }, [loading, me, path]);

  if (loading || !me?.user) return <p className="muted p-16 text-center">Loading…</p>;

  return (
    <div className="min-h-screen sm:flex">
      <aside className="border-b border-[var(--border)] bg-[var(--card)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r">
        <div className="flex items-center gap-2 p-4 font-extrabold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white text-sm">M</span>
          <span>{title}</span>
          <span className="badge bg-brand-100 text-brand-700">{badge}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:flex-col sm:overflow-visible">
          {nav.map((n) => {
            const active = n.href === path || (n.href !== nav[0].href && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-600 text-white font-semibold" : "hover:bg-black/5"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden p-3 sm:block">
          <p className="muted text-xs">{me.user.name}</p>
          <div className="mt-1 flex gap-2 text-xs">
            <Link href="/" className="link">Storefront</Link>
            <button onClick={logout} className="link text-red-600">Sign out</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}

export function ConsoleShell(props: { title: string; badge: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell {...props} />
    </SessionProvider>
  );
}

export function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span className="muted text-xs">{sub}</span>}
    </div>
  );
}
