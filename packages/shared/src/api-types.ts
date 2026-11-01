/**
 * Response shapes shared by the API and the web client, so a change on one
 * side is a type error on the other.
 */
import type { Permission, RoleKey } from "./rbac";

export type ChannelType = "POS" | "WEBSITE" | "SHOPEE" | "LAZADA" | "TIKTOK_SHOP" | "FACEBOOK";
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPING" | "COMPLETED" | "CANCELLED" | "RETURNED";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface SessionTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

/** A shop the user can sign in to (ACTIVE membership). */
export interface ShopChoice {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
  tenant: SessionTenant;
  /** Every shop this user can switch to, including the current one. */
  shops: ShopChoice[];
  role: RoleKey;
  permissions: Permission[];
  /** Locations the user may work in; empty = all. */
  locationIds: string[];
}

export interface RecentOrder {
  id: string;
  code: string;
  channelType: ChannelType;
  customerName: string | null;
  total: number;
  status: OrderStatus;
  placedAt: string;
  assignedToName: string | null;
}

export type DashboardRange = "today" | "7d" | "30d";
export const DASHBOARD_RANGES: readonly DashboardRange[] = ["today", "7d", "30d"];

export interface KpiPair {
  current: number;
  /** Same metric over the previous period of equal length. */
  previous: number;
}

export interface DashboardOverview {
  /** "full" for Admin/Manager, "summary" for Staff (own orders only). */
  scope: "full" | "summary";
  range: DashboardRange;
  generatedAt: string;
  kpis: {
    revenue: KpiPair;
    orders: KpiPair;
    aov: KpiPair;
    cancelRate: KpiPair;
  };
  /** Last 7 days (oldest first), revenue per channel. */
  daily: { date: string; total: number; orders: number; byChannel: Partial<Record<ChannelType, number>> }[];
  channelShare: { channel: ChannelType; orders: number; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStock: { variantId: string; name: string; sku: string; location: string; available: number; reorderPoint: number }[];
  lowStockCount: number;
  monthRevenue: number;
  lastMonthRevenue: number;
  topSeller: { name: string; avatarUrl: string | null; orders: number } | null;
  recentOrders: RecentOrder[];
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
  /** Login without tenantSlug for a user in several shops (error "ShopSelectionRequired"): pick one and log in again. */
  shops?: ShopChoice[];
}
