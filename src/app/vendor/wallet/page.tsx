"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Spinner, EmptyState, useToast, StatusBadge } from "@/components/ui";
import { Metric } from "@/components/console-shell";
import { formatMoney } from "@/lib/money";

type LedgerEntry = { id: string; type: string; amount: number; balanceAfter: number; note: string; createdAt: string };
type Withdrawal = { id: string; amount: number; status: string; requestedAt: string; reviewNote: string };

export default function VendorWalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  async function load() {
    const [w, wd] = await Promise.all([
      api<{ balance: number; ledger: LedgerEntry[] }>("/vendor/wallet"),
      api<{ items: Withdrawal[] }>("/vendor/withdrawals"),
    ]);
    setBalance(w.balance);
    setLedger(w.ledger);
    setWithdrawals(wd.items);
  }
  useEffect(() => { load(); }, []);

  async function requestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/vendor/withdrawals", { method: "POST", body: { amount: Number(amount) } });
      toast("Withdrawal requested");
      setAmount("");
      load();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (balance === null || !ledger || !withdrawals) return <Spinner />;

  return (
    <div className="space-y-6">
      {node}
      <h1 className="section-title">Wallet</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Available balance" value={formatMoney(balance)} />
      </div>

      <form onSubmit={requestWithdrawal} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Withdraw amount (GHS)</label>
          <input className="input" type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? "Requesting…" : "Request withdrawal"}</button>
        <p className="muted w-full text-xs">Paid out to the bank/Mobile Money details on your Store settings page.</p>
      </form>

      <div>
        <h2 className="mb-2 font-semibold">Withdrawal requests</h2>
        {withdrawals.length === 0 ? <EmptyState title="No withdrawals yet" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Date</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Note</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="td">{new Date(w.requestedAt).toLocaleDateString()}</td>
                    <td className="td">{formatMoney(w.amount)}</td>
                    <td className="td"><StatusBadge status={w.status} /></td>
                    <td className="td muted text-xs">{w.reviewNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Recent activity</h2>
        {ledger.length === 0 ? <EmptyState title="No wallet activity yet" hint="Earnings appear once an order is delivered." /> : (
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
