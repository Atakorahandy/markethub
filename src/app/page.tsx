import Link from "next/link";
import { ShopChrome } from "@/components/shop-chrome";

export default function HomePage() {
  return (
    <ShopChrome>
      <section className="card flex flex-col items-center gap-4 px-6 py-16 text-center sm:py-24">
        <span className="badge bg-brand-100 text-brand-700">MarketHub Ghana</span>
        <h1 className="max-w-2xl text-3xl font-extrabold sm:text-5xl">Shop Everything. Delivered Simply.</h1>
        <p className="muted max-w-xl">
          MarketHub connects shoppers with independent vendors across Ghana — one cart, one checkout,
          many stores. The storefront catalog is on its way; sign-up and vendor/delivery-agent
          onboarding are live today.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn-primary">Create your account</Link>
          <Link href="/register?role=vendor" className="btn-ghost">Sell on MarketHub</Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-bold">For shoppers</h2>
          <p className="muted mt-1 text-sm">Browse, buy, and track orders from many vendors in one place. Catalog launches in Phase 2.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">For vendors</h2>
          <p className="muted mt-1 text-sm">Register your store today. Once approved, you&apos;ll manage products, orders and payouts from your own dashboard.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">For delivery agents</h2>
          <p className="muted mt-1 text-sm">Apply to deliver for MarketHub. Verified agents get assigned deliveries and track earnings.</p>
        </div>
      </section>
    </ShopChrome>
  );
}
