"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Captcha } from "@/components/captcha";

function destinationFor(next: string, roles: string[]): string {
  if (next !== "/") return next;
  if (roles.some((k) => ["super_admin", "platform_admin", "support_agent", "finance_officer"].includes(k))) return "/admin";
  if (roles.includes("delivery_agent")) return "/delivery";
  if (roles.some((k) => k.startsWith("vendor_"))) return "/vendor";
  return "/";
}

function MfaStep({ challengeToken, next }: { challengeToken: string; next: string }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api<any>("/auth/mfa/verify", { body: { challengeToken, code } });
      const roles: string[] = res.roles.map((r: any) => r.key);
      window.location.href = destinationFor(next, roles);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-bold">Enter your code</h1>
      <p className="muted text-sm">Enter the 6-digit code from your authenticator app, or a backup code.</p>
      <div>
        <label className="label">Code</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !code}>{busy ? "Verifying…" : "Verify"}</button>
    </form>
  );
}

function LoginForm() {
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api<any>("/auth/login", { body: { email, password, captchaToken } });
      if (res.mfaRequired) {
        setChallengeToken(res.challengeToken);
        setBusy(false);
        return;
      }
      const roles: string[] = res.roles.map((r: any) => r.key);
      window.location.href = destinationFor(next, roles);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (challengeToken) return <MfaStep challengeToken={challengeToken} next={next} />;

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-bold">Sign in</h1>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Captcha onToken={setCaptchaToken} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot" className="link">Forgot password?</Link>
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="link">Create account</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <Suspense fallback={null}><LoginForm /></Suspense>
    </div>
  );
}
