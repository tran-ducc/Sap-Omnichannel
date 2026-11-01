import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "./permissions.guard";

/**
 * Branch scoping for STAFF. `user.locationIds` is null for unrestricted users
 * (ADMIN, MANAGER, or STAFF assigned to "all branches"); otherwise the list of
 * branches they may read and write. Every location-bound query goes through these helpers.
 */
export const OUT_OF_SCOPE = "Bạn không có quyền với chi nhánh này";

export function inScope(user: AuthUser, locationId: string | null | undefined): boolean {
  if (!user.locationIds) return true;
  return !!locationId && user.locationIds.includes(locationId);
}

export function assertInScope(user: AuthUser, ...locationIds: (string | null | undefined)[]) {
  for (const id of locationIds) if (!inScope(user, id)) throw new ForbiddenException(OUT_OF_SCOPE);
}

/**
 * Prisma filter on a `locationId` column. A requested location outside the scope
 * is rejected; no request means "all my branches". Rows with a null locationId
 * (e.g. orders not routed yet) are excluded for restricted users.
 */
export function locationWhere(user: AuthUser, requested?: string | null): { locationId?: string | { in: string[] } } {
  if (requested) {
    assertInScope(user, requested);
    return { locationId: requested };
  }
  return user.locationIds ? { locationId: { in: user.locationIds } } : {};
}

/** Same as locationWhere, as a raw-SQL fragment for `${column} = ...`. */
export function locationSql(user: AuthUser, column: Prisma.Sql, requested?: string | null): Prisma.Sql {
  if (requested) {
    assertInScope(user, requested);
    return Prisma.sql`AND ${column} = ${requested}`;
  }
  // An empty list can't happen (empty membership = unrestricted), but guard anyway.
  if (user.locationIds) return user.locationIds.length ? Prisma.sql`AND ${column} IN (${Prisma.join(user.locationIds)})` : Prisma.sql`AND FALSE`;
  return Prisma.empty;
}
