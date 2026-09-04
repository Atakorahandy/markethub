"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/auth/forgot-password", { body: { email } });
      setSent(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-3 p-6">
        <h1 className="text-lg font-bold">Reset your password</h1>
        {sent ? (
          <p className="text-sm">If that email exists, we&apos;ve sent a reset link. Check your inbox.</p>
        ) : (
          <>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
        <Link href="/login" className="link block text-center text-sm">Back to sign in</Link>
      </form>
    </div>
  );
}
