/** Catalogue & inventory response shapes shared by API and web. */
import type { ChannelType } from "./api-types";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export type InventoryMovementType = "PURCHASE" | "SALE" | "RETURN" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "RESERVE" | "RELEASE";

export interface LocationSummary {
  id: string;
  name: string;
  code: string;
  type: "STORE" | "WAREHOUSE";
}

export interface CategorySummary {
  id: string;
  name: string;
}

export interface ChannelSummary {
  id: string;
  type: ChannelType;
  name: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  defaultLocationId: string | null;
}

export interface StockLevel {
  locationId: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
}

export interface ChannelListingState {
  channelType: ChannelType;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  category: string | null;
  status: ProductStatus;
  imageUrl: string | null;
  variantCount: number;
  priceMin: number;
  priceMax: number;
  totalOnHand: number;
  /** Branches where a variant's sellable stock (onHand - reserved) is at or below its reorder point, out of stock included. */
  lowStockLevels: number;
  channels: ChannelType[];
}

export interface VariantDetail {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  attributes: Record<string, string>;
  price: number;
  /** Omitted for roles that may not see cost (Staff). */
  costPrice?: number | null;
  isActive: boolean;
  levels: StockLevel[];
  listings: ChannelListingState[];
}

/** Photos per product (pasted URLs; no upload yet). */
export const MAX_PRODUCT_IMAGES = 5;

export interface ProductDetail {
  id: string;
  name: string;
  /** http(s) URLs, first is the cover. */
  imageUrls: string[];
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  category: string | null;
  status: ProductStatus;
  options: { name: string; values: string[] }[];
  createdAt: string;
  updatedAt: string;
  variants: VariantDetail[];
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  category: string | null;
  /** Current selling price. */
  price: number;
  levels: StockLevel[];
  listings: ChannelListingState[];
}

export interface InventorySummary {
  skuCount: number;
  totalOnHand: number;
  lowStock: number;
  outOfStock: number;
  /** Cost value of stock on hand; null when the role may not see cost. */
  stockValue: number | null;
}

export interface InventoryList extends Page<InventoryRow> {
  summary: InventorySummary;
}

export interface MovementItem {
  id: string;
  type: InventoryMovementType;
  quantity: number;
  locationId: string;
  locationName: string;
  note: string | null;
  referenceType: string | null;
  referenceCode: string | null;
  actorName: string | null;
  createdAt: string;
}

/** Socket.io events (namespace /realtime, room per tenant). */
export interface InventoryChangedEvent {
  variantId: string;
  level: StockLevel;
  movementType: InventoryMovementType;
  quantity: number;
  actorName: string | null;
}

export interface ChannelSyncedEvent {
  variantId: string;
  listings: ChannelListingState[];
}
