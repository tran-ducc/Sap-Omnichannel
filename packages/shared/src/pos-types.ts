/** Point of sale: shapes shared by API and web. */
import type { PaymentMethod } from "./order-types";

export type PosPaymentMethod = Extract<PaymentMethod, "CASH" | "BANK_TRANSFER" | "CARD">;

export interface PosShift {
  id: string;
  location: { id: string; name: string };
  openedAt: string;
  openingCash: number;
  /** Running totals for this shift. */
  orders: number;
  revenue: number;
  byMethod: Partial<Record<PosPaymentMethod, number>>;
  /** Opening cash + cash sales: what the drawer should hold. */
  expectedCash: number;
}

export interface PosProduct {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  category: string | null;
  price: number;
  /** Sellable at the shift's location (on hand − reserved). */
  available: number;
}

export interface PosReceipt {
  orderId: string;
  code: string;
  at: string;
  shopName: string;
  locationName: string;
  cashierName: string;
  customer: { fullName: string; phone: string | null; pointsEarned: number; pointsTotal: number } | null;
  items: { name: string; sku: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  method: PosPaymentMethod;
  /** Cash handed over by the customer (cash only). */
  received: number | null;
  change: number | null;
}

export interface ShiftCloseReport {
  id: string;
  location: string;
  openedAt: string;
  closedAt: string;
  orders: number;
  revenue: number;
  byMethod: Partial<Record<PosPaymentMethod, number>>;
  openingCash: number;
  expectedCash: number;
  countedCash: number;
  /** counted − expected; negative means the drawer is short. */
  difference: number;
}
