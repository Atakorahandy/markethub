import { ConsoleShell } from "@/components/console-shell";

const NAV = [{ href: "/vendor", label: "Dashboard" }];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell title="MarketHub" badge="Vendor" nav={NAV}>{children}</ConsoleShell>;
}
