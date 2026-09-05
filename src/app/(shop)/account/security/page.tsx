"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShopChrome } from "@/components/shop-chrome";
import { useSession } from "@/components/session";
import { Spinner, useToast } from "@/components/ui";
import { api } from "@/lib/client";

function EnrollFlow({ onEnabled }: { onEnabled: () => void }) {
  const [step, setStep] = useState<"start" | "scan" | "backup">("start");
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ secret: string; otpauthUri: string }>("/auth/mfa/enroll", { method: "POST" });
      setSecret(res.secret);
      setOtpauthUri(res.otpauthUri);
      setStep("scan");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ backupCodes: string[] }>("/auth/mfa/confirm", { method: "POST", body: { code } });
      setBackupCodes(res.backupCodes);
      setStep("backup");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "start") {
    return (
      <div className="card space-y-3 p-5">
        <p className="text-sm">
          Two-factor authentication adds a second step to signing in — a 6-digit code from an authenticator app
          (Google Authenticator, Authy, 1Password, etc.) alongside your password.
        </p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={start} disabled={busy} className="btn-primary">{busy ? "Starting…" : "Enable two-factor authentication"}</button>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <form onSubmit={confirm} className="card space-y-3 p-5">
        <p className="text-sm font-semibold">1. Add this account to your authenticator app</p>
        <p className="muted text-xs">
          Your app likely has an option to enter a setup key manually — no QR scanning needed. Paste this key:
        </p>
        <code className="block break-all rounded-lg bg-black/5 p-3 text-sm">{secret}</code>
        <p className="muted text-xs">Or use this link on a device with the app installed: <span className="break-all">{otpauthUri}</span></p>
        <div>
          <label className="label">2. Enter the 6-digit code it shows</label>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary" disabled={busy || code.length !== 6}>{busy ? "Confirming…" : "Confirm and enable"}</button>
      </form>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm font-semibold text-emerald-700">Two-factor authentication is now enabled.</p>
      <p className="muted text-sm">
        Save these one-time backup codes somewhere safe — each can be used once to sign in if you lose access to your
        authenticator app. They won&apos;t be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/5 p-3 font-mono text-sm">
        {backupCodes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <button onClick={onEnabled} className="btn-primary">Done</button>
    </div>
  );
}

function DisableFlow({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/auth/mfa/disable", { method: "POST", body: { password, code } });
      onDisabled();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <p className="text-sm font-semibold text-emerald-700">Two-factor authentication is enabled.</p>
      <p className="muted text-sm">Confirm your password and a current code (or a backup code) to turn it off.</p>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div>
        <label className="label">Authenticator or backup code</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-danger" disabled={busy}>{busy ? "Disabling…" : "Disable two-factor authentication"}</button>
    </form>
  );
}

function SecurityBody() {
  const { me, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const { toast, node } = useToast();

  async function load() {
    const res = await api<{ enabled: boolean }>("/auth/mfa/status");
    setEnabled(res.enabled);
  }

  useEffect(() => {
    if (!sessionLoading && !me?.user) router.replace("/login?next=/account/security");
    if (!sessionLoading && me?.user && !me.isSuperAdmin && !me.isPlatformStaff) router.replace("/account");
    if (me?.user) load();
  }, [sessionLoading, me]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sessionLoading || enabled === null) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {node}
      <h1 className="section-title">Security</h1>
      {enabled ? (
        <DisableFlow onDisabled={() => { toast("Two-factor authentication disabled"); load(); }} />
      ) : (
        <EnrollFlow onEnabled={() => { toast("Two-factor authentication enabled"); load(); }} />
      )}
    </div>
  );
}

export default function SecurityPage() {
  return <ShopChrome><SecurityBody /></ShopChrome>;
}
