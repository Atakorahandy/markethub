"use client";

import Link from "next/link";
import { SessionProvider, useSession } from "./session";

function Header() {
  const { me, loading, logout } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">M</span>
          MarketHub
        </Link>
        <div className="hidden flex-1 sm:block">
          <input className="input" placeholder="Search products, brands, stores… (coming soon)" disabled />
        </div>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          {!loading && me?.user ? (
            <>
              <Link href="/account" className="link">{me.user.name.split(" ")[0]}</Link>
              <button onClick={logout} className="link text-red-600">Sign out</button>
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className="link">Sign in</Link>
              <Link href="/register" className="btn-primary btn-sm">Sign up</Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] py-8 text-center text-sm">
      <p className="muted">© {new Date().getFullYear()} MarketHub. Built for Ghana, ready for Africa.</p>
      <div className="mt-2 flex justify-center gap-4">
        <Link href="/register?role=vendor" className="link">Sell on MarketHub</Link>
        <Link href="/register?role=delivery_agent" className="link">Become a delivery agent</Link>
      </div>
    </footer>
  );
}

export function ShopChrome({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      <Footer />
    </SessionProvider>
  );
}
