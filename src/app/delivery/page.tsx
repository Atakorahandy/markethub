"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, StatusBadge } from "@/components/ui";

type AgentSummary = { id: string; status: string; verification: string; vehicleType: string; city: string; region: string };

export default function DeliveryDashboard() {
  const [agent, setAgent] = useState<AgentSummary | null | undefined>(undefined);

  useEffect(() => {
    api<AgentSummary>("/delivery-agent/me").then(setAgent, () => setAgent(null));
  }, []);

  if (agent === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="section-title">Delivery agent dashboard</h1>
      {agent ? (
        <div className="card space-y-2 p-5">
          <p className="font-semibold">Verification status <StatusBadge status={agent.verification} /></p>
          <p className="muted text-sm capitalize">{agent.vehicleType.replace("_", " ")} · {agent.city}, {agent.region}</p>
          {agent.verification !== "verified" && (
            <p className="muted text-sm">
              Assigned deliveries, routes and earnings unlock once an administrator verifies your
              application. This is built in Phase 6 of the roadmap.
            </p>
          )}
        </div>
      ) : (
        <p className="muted">We couldn&apos;t load your delivery agent profile.</p>
      )}
    </div>
  );
}
