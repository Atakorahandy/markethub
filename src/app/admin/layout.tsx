import { ConsoleShell } from "@/components/console-shell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/delivery-agents", label: "Delivery agents" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/cms", label: "CMS" },
  { href: "/admin/audit-log", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell title="MarketHub" badge="Admin" nav={NAV}>{children}</ConsoleShell>;
}
