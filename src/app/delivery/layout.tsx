import { ConsoleShell } from "@/components/console-shell";

const NAV = [
  { href: "/delivery", label: "Dashboard" },
  { href: "/delivery/pool", label: "Available jobs" },
  { href: "/delivery/deliveries", label: "My deliveries" },
  { href: "/delivery/earnings", label: "Earnings" },
];

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell title="MarketHub" badge="Delivery" nav={NAV}>{children}</ConsoleShell>;
}
