"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

function LoginForm() {
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api<any>("/auth/login", { body: { email, password } });
      const roles: string[] = res.roles.map((r: any) => r.key);
      const dest =
        next !== "/" ? next
        : roles.includes("super_admin") || roles.includes("platform_admin") || roles.includes("support_agent") || roles.includes("finance_officer") ? "/admin"
        : roles.includes("delivery_agent") ? "/delivery"
        : roles.some((k) => k.startsWith("vendor_")) ? "/vendor"
        : "/";
      window.location.href = dest;
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

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
