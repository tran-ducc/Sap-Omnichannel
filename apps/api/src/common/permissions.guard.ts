import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { canAll, type Permission, type RoleKey } from "@omni/shared";

export const PERMISSIONS_KEY = "requiredPermissions";

/** Declare the permissions a route needs, e.g. @RequirePermission("product:update_price"). */
export const RequirePermission = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Shape attached to `request.user` by the JWT guard. */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: RoleKey;
  /** Branches a STAFF member is limited to; null = no limit. See common/location-scope.ts. */
  locationIds: string[] | null;
}

/**
 * Runs after the JWT guard. Routes without @RequirePermission only need a
 * valid session; routes with it need every listed permission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException("Bạn cần đăng nhập để thực hiện thao tác này");
    if (!canAll(user.role, required)) {
      throw new ForbiddenException("Vai trò của bạn không có quyền thực hiện thao tác này");
    }
    return true;
  }
}
