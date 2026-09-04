import { ConsoleShell } from "@/components/console-shell";

const NAV = [{ href: "/delivery", label: "Dashboard" }];

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell title="MarketHub" badge="Delivery" nav={NAV}>{children}</ConsoleShell>;
}
