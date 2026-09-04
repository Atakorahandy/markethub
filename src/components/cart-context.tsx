"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";
import { useSession } from "./session";

export type CartLine = {
  id: string; productId: string; productSlug: string; productName: string; image: string | null;
  variantId: string | null; variantLabel: string | null; unitPrice: number; quantity: number;
  availableStock: number; unavailable: boolean; exceedsStock: boolean; lineTotal: number;
  vendor: { id: string; businessName: string; slug: string; status: string };
};
export type VendorGroup = { vendorId: string; vendorName: string; deliveryFee: number; subtotal: number; lines: CartLine[] };
export type CartSummary = {
  lines: CartLine[]; vendorGroups: VendorGroup[]; subtotal: number; deliveryFee: number; total: number;
  itemCount: number; readyToCheckout: boolean;
};

const Ctx = createContext<{ cart: CartSummary | null; loading: boolean; refresh: () => Promise<void> }>({
  cart: null, loading: true, refresh: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!me?.user) {
      setCart(null);
      setLoading(false);
      return;
    }
    try {
      setCart(await api<CartSummary>("/cart"));
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ cart, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
