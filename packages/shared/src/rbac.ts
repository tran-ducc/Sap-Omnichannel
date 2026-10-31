/**
 * Role-based access control — single source of truth shared by the API
 * (NestJS guards) and the web app (hiding nav items / disabling actions).
 *
 * Permissions are "resource:action" strings. The API is the real enforcement
 * point; the UI only uses these to avoid showing actions a user cannot take.
 */

export const ROLE_KEYS = ["ADMIN", "MANAGER", "STAFF"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  // Store / tenant
  "tenant:delete",
  "settings:system",
  "settings:store",
  "location:manage",
  "channel:manage",
  // Catalog & stock
  "product:read",
  "product:create",
  "product:update",
  "product:delete",
  "product:update_price",
  "inventory:read",
  "inventory:adjust",
  "inventory:transfer",
  // Orders & POS
  "order:read_all",
  "order:read_assigned",
  "order:create",
  "order:update",
  "order:cancel",
  "pos:sell",
  "pos:discount",
  // Customers
  "customer:read",
  "customer:manage",
  // Reports
  "report:summary",
  "report:detailed",
  // Staff
  "staff:read",
  "staff:manage",
  // Audit
  "activity:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MANAGER_PERMISSIONS: Permission[] = [
  "settings:store",
  "location:manage",
  "channel:manage",
  "product:read",
  "product:create",
  "product:update",
  "product:delete",
  "product:update_price",
  "inventory:read",
  "inventory:adjust",
  "inventory:transfer",
  "order:read_all",
  "order:read_assigned",
  "order:create",
  "order:update",
  "order:cancel",
  "pos:sell",
  "pos:discount",
  "customer:read",
  "customer:manage",
  "report:summary",
  "report:detailed",
  "staff:read",
  "staff:manage",
  "activity:read",
];

// Staff sell and look things up; they cannot change prices, see detailed
// reports or manage people.
const STAFF_PERMISSIONS: Permission[] = [
  "product:read",
  "inventory:read",
  "order:read_assigned",
  "order:create",
  "pos:sell",
  "customer:read",
  "customer:manage",
  "report:summary",
];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

export function can(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAll(role: RoleKey, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}
