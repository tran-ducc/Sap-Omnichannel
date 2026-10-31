import type { Permission } from "@omni/shared";
import {
  BarChart3,
  Bell,
  Boxes,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** URL segment under /app */
  slug: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user holds ANY of these. */
  anyOf: Permission[];
  /** Built screens; the rest render a "coming next" state. */
  ready?: boolean;
  group: "main" | "manage" | "system";
}

/** Single source for sidebar, page titles and route permission checks. */
export const NAV: NavItem[] = [
  { slug: "dashboard", label: "Tổng quan", icon: LayoutDashboard, anyOf: ["report:summary"], ready: true, group: "main" },
  { slug: "pos", label: "Bán tại quầy", icon: ShoppingCart, anyOf: ["pos:sell"], ready: true, group: "main" },
  { slug: "orders", label: "Đơn hàng", icon: Receipt, anyOf: ["order:read_all", "order:read_assigned"], ready: true, group: "main" },
  { slug: "products", label: "Sản phẩm", icon: Package, anyOf: ["product:read"], ready: true, group: "manage" },
  { slug: "inventory", label: "Tồn kho", icon: Boxes, anyOf: ["inventory:read"], ready: true, group: "manage" },
  { slug: "customers", label: "Khách hàng", icon: Users, anyOf: ["customer:read"], ready: true, group: "manage" },
  { slug: "reports", label: "Báo cáo", icon: BarChart3, anyOf: ["report:detailed"], ready: true, group: "manage" },
  { slug: "staff", label: "Nhân viên", icon: UserCog, anyOf: ["staff:read"], ready: true, group: "system" },
  { slug: "notifications", label: "Thông báo", icon: Bell, anyOf: ["report:summary", "pos:sell"], ready: true, group: "system" },
  { slug: "activity", label: "Nhật ký hoạt động", icon: History, anyOf: ["activity:read"], ready: true, group: "system" },
  { slug: "settings", label: "Cài đặt", icon: Settings, anyOf: ["settings:store", "settings:system"], ready: true, group: "system" },
];

export const NAV_GROUP_LABEL: Record<NavItem["group"], string> = {
  main: "Bán hàng",
  manage: "Quản lý",
  system: "Hệ thống",
};

export function navFor(permissions: readonly Permission[]) {
  return NAV.filter((n) => n.anyOf.some((p) => permissions.includes(p)));
}
