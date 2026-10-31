"use client";

import type { PosPaymentMethod, PosProduct } from "@omni/shared";
import { useEffect, useState } from "react";

export interface CartLine {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  available: number;
  quantity: number;
}

export interface CartState {
  /** Sent with checkout so a retried submit can't create a second order. */
  clientRef: string;
  lines: CartLine[];
  phone: string;
  newCustomerName: string;
  discount: string;
  method: PosPaymentMethod;
  received: string;
}

const fresh = (): CartState => ({ clientRef: crypto.randomUUID(), lines: [], phone: "", newCustomerName: "", discount: "", method: "CASH", received: "" });

/**
 * Cart for one shift, kept in localStorage so a reload or a tablet going to
 * sleep doesn't lose a half-rung sale. Storage failures (private mode) are
 * ignored: the cart still works in memory.
 */
export function usePosCart(shiftId: string) {
  const key = `pos-cart:${shiftId}`;
  const [cart, setCart] = useState<CartState>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? { ...fresh(), ...(JSON.parse(saved) as CartState) } : fresh();
    } catch {
      return fresh();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(cart));
    } catch {
      /* storage unavailable */
    }
  }, [key, cart]);

  const add = (p: PosProduct) =>
    setCart((c) => {
      const line = c.lines.find((l) => l.variantId === p.variantId);
      if (line) return { ...c, lines: c.lines.map((l) => (l.variantId === p.variantId ? { ...l, available: p.available, quantity: Math.min(l.quantity + 1, p.available) } : l)) };
      if (p.available <= 0) return c;
      return {
        ...c,
        lines: [...c.lines, { variantId: p.variantId, productName: p.productName, variantName: p.variantName, sku: p.sku, price: p.price, available: p.available, quantity: 1 }],
      };
    });

  const setQty = (variantId: string, quantity: number) =>
    setCart((c) => ({
      ...c,
      lines: quantity <= 0 ? c.lines.filter((l) => l.variantId !== variantId) : c.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, l.available) } : l)),
    }));

  const setAvailable = (variantId: string, available: number) =>
    setCart((c) => (c.lines.some((l) => l.variantId === variantId) ? { ...c, lines: c.lines.map((l) => (l.variantId === variantId ? { ...l, available } : l)) } : c));

  const patch = (p: Partial<CartState>) => setCart((c) => ({ ...c, ...p }));
  const reset = () => setCart(fresh());

  return { cart, add, setQty, setAvailable, patch, reset };
}
