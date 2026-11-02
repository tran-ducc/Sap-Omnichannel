/** Reports, CRM, staff, settings, notifications, activity: shapes shared by API and web. */
import type { ChannelType, OrderStatus } from "./api-types";
import type { LocationSummary } from "./catalog-types";
import type { RoleKey } from "./rbac";

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportGroupBy = "day" | "week" | "month";

export interface SalesSummary {
  revenue: number;
  orders: number;
  aov: number;
  /**
   * Revenue − cost of goods. Uses the cost snapshotted on each order line at
   * sale time; lines sold before that existed fall back to today's cost price.
   */
  grossProfit: number;
  margin: number;
  itemsSold: number;
  cancelled: number;
  cancelRate: number;
  returned: number;
  newCustomers: number;
  /** Orders placed in the period still in progress (PENDING…SHIPPING): count and value, not revenue. */
  inProgressOrders: number;
  inProgressTotal: number;
  /** Units whose cost had no snapshot (older lines): their profit is an estimate at today's cost price. */
  costEstimatedItems: number;
}

export interface SalesReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  summary: SalesSummary;
  /** Same metrics over the previous period of equal length. */
  previous: Pick<SalesSummary, "revenue" | "orders" | "grossProfit" | "aov">;
  series: { period: string; revenue: number; orders: number; byChannel: Partial<Record<ChannelType, number>> }[];
  channels: { channel: ChannelType; orders: number; revenue: number; share: number }[];
  locations: { locationId: string; name: string; orders: number; revenue: number }[];
  /** `profitEstimated`: some units of this product had no cost snapshot (see SalesSummary.costEstimatedItems). */
  products: { name: string; sku: string; quantity: number; revenue: number; profit: number; profitEstimated: boolean }[];
  categories: { name: string; quantity: number; revenue: number }[];
  staff: { userId: string; fullName: string; avatarUrl: string | null; posOrders: number; posRevenue: number; handledOrders: number }[];
  /** heatmap[weekday][hour] = orders; weekday 0 = Monday (Vietnam time). */
  heatmap: number[][];
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerListItem {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  tags: string[];
  loyaltyPoints: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface CustomerDetail extends CustomerListItem {
  gender: string | null;
  birthday: string | null;
  address: string | null;
  note: string | null;
  averageOrder: number;
  channels: { channel: ChannelType; orders: number; revenue: number }[];
  orders: { id: string; code: string; channelType: ChannelType; status: OrderStatus; total: number; placedAt: string }[];
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export type MemberStatus = "INVITED" | "ACTIVE" | "DISABLED";

export interface StaffMember {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: RoleKey;
  status: MemberStatus;
  /** Empty = all locations. */
  locationIds: string[];
  lastLoginAt: string | null;
  ordersThisMonth: number;
  revenueThisMonth: number;
  isSelf: boolean;
  /** Whether the current user may edit this member (role hierarchy). */
  editable: boolean;
}

/**
 * Returned once when a member is added or their password is reset.
 * `temporaryPassword` is null when an existing account (from another shop)
 * was added: they keep signing in with their own password.
 */
export interface TemporaryCredential {
  member: StaffMember;
  temporaryPassword: string | null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  currency: string;
  timezone: string;
  trialEndsAt: string | null;
  createdAt: string;
  counts: { locations: number; channels: number; members: number; products: number };
}

export interface LocationDetail extends LocationSummary {
  address: string | null;
  phone: string | null;
  isActive: boolean;
  stockUnits: number;
}

export interface ChannelDetail {
  id: string;
  type: ChannelType;
  name: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  defaultLocationId: string | null;
  lastSyncedAt: string | null;
  listings: number;
  failedListings: number;
  /** True while the channel syncs against the mock adapter (no marketplace API connection). */
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Notifications & activity
// ---------------------------------------------------------------------------

export type NotificationType = "order.new" | "stock.low" | "shift.discrepancy" | "sync.failed";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** In-app link to open when clicked. */
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; fullName: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
