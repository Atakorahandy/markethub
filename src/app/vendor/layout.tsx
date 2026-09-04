import { ConsoleShell } from "@/components/console-shell";

const NAV = [
  { href: "/vendor", label: "Dashboard" },
  { href: "/vendor/products", label: "Products" },
  { href: "/vendor/orders", label: "Orders" },
  { href: "/vendor/flash-sales", label: "Flash sales" },
  { href: "/vendor/coupons", label: "Coupons" },
  { href: "/vendor/reviews", label: "Reviews" },
  { href: "/vendor/analytics", label: "Analytics" },
  { href: "/vendor/wallet", label: "Wallet" },
  { href: "/vendor/store", label: "Store settings" },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell title="MarketHub" badge="Vendor" nav={NAV}>{children}</ConsoleShell>;
}
