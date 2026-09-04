"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/auth/reset-password", { body: { token, password } });
      setDone(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-6">
      <h1 className="text-lg font-bold">Choose a new password</h1>
      {done ? (
        <p className="text-sm">Your password has been updated. You can now <a href="/login" className="link">sign in</a>.</p>
      ) : (
        <>
          {!token && <p className="text-sm text-red-600">This link is missing its reset token.</p>}
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full" disabled={busy || !token}>{busy ? "Saving…" : "Save new password"}</button>
        </>
      )}
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Suspense fallback={null}><ResetForm /></Suspense>
    </div>
  );
}
