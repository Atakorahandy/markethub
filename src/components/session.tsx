"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";

export type Me = {
  user: { id: string; name: string; email: string; phone: string | null; kind: string; avatarUrl: string | null } | null;
  roleKeys: string[];
  permissions: string[];
  vendorIds: string[];
  deliveryAgentId: string | null;
  isSuperAdmin: boolean;
  isPlatformStaff: boolean;
};

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }>({
  me: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/auth/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    window.location.href = "/";
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
