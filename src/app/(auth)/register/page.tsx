"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { GHANA_REGIONS, VEHICLE_TYPES } from "@/lib/constants";

type Role = "customer" | "vendor" | "delivery_agent";

const ROLE_LABEL: Record<Role, string> = {
  customer: "Shop as a customer",
  vendor: "Sell as a vendor",
  delivery_agent: "Deliver as an agent",
};

function RegisterForm() {
  const params = useSearchParams();
  const initialRole = (params.get("role") as Role) || "customer";

  const [role, setRole] = useState<Role>(["customer", "vendor", "delivery_agent"].includes(initialRole) ? initialRole : "customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState<string>(GHANA_REGIONS[0]);
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLE_TYPES)[number]["key"]>("motorbike");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/auth/register", {
        body: {
          name, email, phone, password, role,
          ...(role === "vendor" ? { businessName, city, region } : {}),
          ...(role === "delivery_agent" ? { city, region, vehicleType } : {}),
        },
      });
      const dest = role === "vendor" ? "/vendor" : role === "delivery_agent" ? "/delivery" : "/";
      window.location.href = dest;
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-lg font-bold">Create your account</h1>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-xl border px-2 py-2 text-xs font-semibold ${role === r ? "border-brand-600 bg-brand-50 text-brand-700" : "border-[var(--border)]"}`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Full name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024xxxxxxx" required />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>

      {role === "vendor" && (
        <div>
          <label className="label">Business name</label>
          <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </div>
      )}

      {(role === "vendor" || role === "delivery_agent") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div>
            <label className="label">Region</label>
            <select className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}

      {role === "delivery_agent" && (
        <div>
          <label className="label">Vehicle type</label>
          <select className="select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as typeof vehicleType)}>
            {VEHICLE_TYPES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
      )}

      {(role === "vendor" || role === "delivery_agent") && (
        <p className="muted text-xs">
          {role === "vendor"
            ? "Your store application will be reviewed by our team before you can list products."
            : "Your delivery agent application will be reviewed and verified before you can accept deliveries."}
        </p>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm">Already have an account? <Link href="/login" className="link">Sign in</Link></p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <Suspense fallback={null}><RegisterForm /></Suspense>
    </div>
  );
}
