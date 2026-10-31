import type { ChannelType, OrderStatus, PaymentMethod, PaymentStatus, RoleKey } from "@omni/shared";

/** Display data for API channel types. Colour is always shown next to the label. */
export const CHANNEL_META: Record<ChannelType, { label: string; color: string }> = {
  POS: { label: "Tại quầy", color: "var(--ch-pos)" },
  WEBSITE: { label: "Website", color: "var(--ch-website)" },
  SHOPEE: { label: "Shopee", color: "var(--ch-shopee)" },
  LAZADA: { label: "Lazada", color: "var(--ch-lazada)" },
  TIKTOK_SHOP: { label: "TikTok Shop", color: "var(--ch-tiktok)" },
  FACEBOOK: { label: "Facebook", color: "var(--ch-facebook)" },
};

export type Tone = "done" | "waiting" | "moving" | "stopped";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Chờ xác nhận", tone: "waiting" },
  CONFIRMED: { label: "Đã xác nhận", tone: "waiting" },
  PROCESSING: { label: "Đang đóng gói", tone: "moving" },
  SHIPPING: { label: "Đang giao", tone: "moving" },
  COMPLETED: { label: "Hoàn thành", tone: "done" },
  CANCELLED: { label: "Đã huỷ", tone: "stopped" },
  RETURNED: { label: "Trả hàng", tone: "stopped" },
};

export const TONE_CLASS: Record<Tone, string> = {
  done: "bg-lime text-lime-foreground",
  waiting: "bg-amber-soft text-amber-ink",
  moving: "bg-muted text-foreground",
  stopped: "bg-destructive/10 text-destructive",
};

export const ROLE_LABEL: Record<RoleKey, string> = { ADMIN: "Admin", MANAGER: "Quản lý", STAFF: "Nhân viên" };

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  UNPAID: { label: "Chưa thanh toán", tone: "waiting" },
  PARTIALLY_PAID: { label: "Trả một phần", tone: "waiting" },
  PAID: { label: "Đã thanh toán", tone: "done" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "stopped" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  EWALLET: "Ví điện tử, sàn thu hộ",
  COD: "Thu hộ khi giao (COD)",
};

/** Button label for moving an order INTO a status. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  PENDING: "Đưa về chờ xác nhận",
  CONFIRMED: "Xác nhận đơn",
  PROCESSING: "Bắt đầu đóng gói",
  SHIPPING: "Giao cho vận chuyển",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Huỷ đơn",
  RETURNED: "Ghi nhận trả hàng",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
