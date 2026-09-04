"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState } from "@/components/ui";
import { Metric } from "@/components/console-shell";
import { formatMoney } from "@/lib/money";

type LedgerEntry = { id: string; type: string; amount: number; balanceAfter: number; note: string; createdAt: string };

export default function DeliveryEarningsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  useEffect(() => {
    api<{ balance: number; ledger: LedgerEntry[]; completedCount: number }>("/delivery/earnings").then((r) => {
      setBalance(r.balance);
      setLedger(r.ledger);
      setCompletedCount(r.completedCount);
    });
  }, []);

  if (balance === null || !ledger) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="section-title">Earnings</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Total earned" value={formatMoney(balance)} />
        <Metric label="Completed deliveries" value={completedCount ?? "…"} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Activity</h2>
        {ledger.length === 0 ? (
          <EmptyState title="No earnings yet" hint="Complete a delivery to start earning." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Amount</th><th className="th">Balance</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="td">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="td capitalize">{l.type.replace(/_/g, " ")}</td>
                    <td className={`td ${l.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{l.amount < 0 ? "-" : "+"}{formatMoney(Math.abs(l.amount))}</td>
                    <td className="td">{formatMoney(l.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
