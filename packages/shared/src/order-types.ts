/** Orders: state machine and response shapes shared by API and web. */
import type { ChannelType, OrderStatus } from "./api-types";
import type { Page } from "./catalog-types";
import type { Permission } from "./rbac";

export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "EWALLET" | "COD";

/**
 * Allowed status changes. Stock effects (applied by the API):
 * - order placed            → reserve stock
 * - → SHIPPING / COMPLETED  → deduct on-hand (SALE) and release the reservation
 * - → CANCELLED             → release the reservation
 * - → RETURNED              → put shipped units back (RETURN)
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["COMPLETED", "RETURNED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Permission needed to move an order INTO a status. */
export const TRANSITION_PERMISSION: Record<OrderStatus, Permission> = {
  PENDING: "order:update",
  CONFIRMED: "order:update",
  PROCESSING: "order:update",
  SHIPPING: "order:update",
  COMPLETED: "order:update",
  CANCELLED: "order:cancel",
  RETURNED: "order:cancel",
};

export interface PersonRef {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface OrderListItem {
  id: string;
  code: string;
  channelType: ChannelType;
  externalOrderId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  assignedTo: PersonRef | null;
  placedAt: string;
}

export interface OrderList extends Page<OrderListItem> {
  counts: {
    byStatus: Partial<Record<OrderStatus | "ALL", number>>;
    byChannel: Partial<Record<ChannelType, number>>;
  };
}

export interface OrderItemDetail {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface OrderTimelineEntry {
  id: string;
  action: string;
  actorName: string | null;
  at: string;
  metadata: Record<string, unknown> | null;
}

export interface OrderDetail {
  id: string;
  code: string;
  channelType: ChannelType;
  channelName: string;
  externalOrderId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  total: number;
  note: string | null;
  cancelReason: string | null;
  shippingAddress: { name?: string; phone?: string; address?: string } | null;
  customer: { id: string; fullName: string; phone: string | null; orderCount: number; totalSpent: number } | null;
  location: { id: string; name: string } | null;
  assignedTo: PersonRef | null;
  createdBy: PersonRef | null;
  items: OrderItemDetail[];
  payments: { id: string; method: PaymentMethod; amount: number; paidAt: string }[];
  timeline: OrderTimelineEntry[];
  stockReserved: boolean;
  stockDeducted: boolean;
  placedAt: string;
  /** Next statuses this user may set. */
  allowedTransitions: OrderStatus[];
}

export interface Assignee extends PersonRef {
  role: string;
}

export interface CustomerLite {
  id: string;
  fullName: string;
  phone: string | null;
  orderCount: number;
}

/** Realtime: `order.created` / `order.updated`. Clients refetch what they display. */
export interface OrderEvent {
  orderId: string;
  code: string;
  channelType: ChannelType;
  status: OrderStatus;
  total: number;
  assignedToId: string | null;
  /** Fulfilment branch; lets branch-limited staff ignore other branches' events. */
  locationId: string | null;
  kind: "created" | "updated";
}
