"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, StatusBadge, useToast } from "@/components/ui";
import { Metric } from "@/components/console-shell";
import { formatMoney } from "@/lib/money";

type AgentSummary = { id: string; status: string; verification: string; vehicleType: string; city: string; region: string };

export default function DeliveryDashboard() {
  const [agent, setAgent] = useState<AgentSummary | null | undefined>(undefined);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    api<AgentSummary>("/delivery-agent/me").then(setAgent, () => setAgent(null));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (agent?.verification !== "verified") return;
    api<{ items: unknown[] }>("/delivery/pool").then((r) => setPoolCount(r.items.length));
    Promise.all([
      api<{ items: unknown[] }>("/delivery/deliveries?status=assigned"),
      api<{ items: unknown[] }>("/delivery/deliveries?status=picked_up"),
      api<{ items: unknown[] }>("/delivery/deliveries?status=out_for_delivery"),
    ]).then(([a, b, c]) => setActiveCount(a.items.length + b.items.length + c.items.length));
    api<{ balance: number }>("/delivery/earnings").then((r) => setBalance(r.balance));
  }, [agent]);

  async function toggleOnline() {
    if (!agent) return;
    const next = agent.status === "online" ? "offline" : "online";
    setBusy(true);
    try {
      await api("/delivery/me/status", { method: "PATCH", body: { status: next } });
      await load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (agent === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      {node}
      <h1 className="section-title">Delivery agent dashboard</h1>
      {agent ? (
        <>
          <div className="card space-y-2 p-5">
            <p className="font-semibold">Status <StatusBadge status={agent.verification} /> <StatusBadge status={agent.status} /></p>
            <p className="muted text-sm capitalize">{agent.vehicleType.replace("_", " ")} · {agent.city}, {agent.region}</p>
            {agent.verification !== "verified" ? (
              <p className="muted text-sm">
                Assigned deliveries, routes and earnings unlock once an administrator verifies your application.
              </p>
            ) : (
              <button onClick={toggleOnline} disabled={busy || agent.status === "on_delivery"} className={agent.status === "online" ? "btn-danger btn-sm" : "btn-primary btn-sm"}>
                {busy ? "Updating…" : agent.status === "online" ? "Go offline" : agent.status === "on_delivery" ? "On a delivery" : "Go online"}
              </button>
            )}
          </div>

          {agent.verification === "verified" && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Available jobs" value={poolCount ?? "…"} />
                <Metric label="Active deliveries" value={activeCount ?? "…"} />
                <Metric label="Earnings balance" value={balance != null ? formatMoney(balance) : "…"} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/delivery/pool" className="btn-primary btn-sm">Browse available jobs</Link>
                <Link href="/delivery/deliveries" className="btn-ghost btn-sm">My deliveries</Link>
                <Link href="/delivery/earnings" className="btn-ghost btn-sm">Earnings</Link>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="muted">We couldn&apos;t load your delivery agent profile.</p>
      )}
    </div>
  );
}
