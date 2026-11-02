import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { RoleKey } from "@omni/shared";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.module";
import { NO_SHOP_ACCESS, SHOP_SUSPENDED } from "../modules/auth/auth.service";
import type { AuthUser } from "./permissions.guard";

export const IS_PUBLIC_KEY = "isPublic";
/** Opt a route out of the global JWT guard (login, register, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Access-token payload. Kept small: it travels on every request. */
export interface AccessTokenPayload {
  sub: string; // user id
  tid: string; // tenant id
  role: RoleKey;
}

/** Injects the authenticated user: `me(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/**
 * Global guard: every route needs a valid Bearer access token unless marked
 * @Public(). The tenant comes from the token, never from the request body,
 * so a user cannot read another shop's data by changing an id.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Phiên đăng nhập không hợp lệ");

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }
    await this.assertAccess(payload);
    req.user = { userId: payload.sub, tenantId: payload.tid, role: payload.role, locationIds: await this.branchScope(payload) };
    return true;
  }

  /**
   * A valid signature isn't enough: a disabled user, a removed membership or a
   * suspended shop is refused on the next request instead of when the token expires.
   */
  private async assertAccess(p: AccessTokenPayload): Promise<void> {
    const m = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: p.sub, tenantId: p.tid } },
      select: { status: true, user: { select: { isActive: true } }, tenant: { select: { status: true } } },
    });
    if (!m || m.status !== "ACTIVE" || !m.user.isActive) throw new UnauthorizedException(NO_SHOP_ACCESS);
    if (m.tenant.status === "SUSPENDED") throw new UnauthorizedException(SHOP_SUSPENDED);
  }

  /**
   * Branch scope is read from the membership on each STAFF request rather than
   * put in the JWT: existing tokens keep working and a narrowed assignment takes
   * effect immediately. ADMIN/MANAGER manage the whole shop and skip the query.
   */
  private async branchScope(p: AccessTokenPayload): Promise<string[] | null> {
    if (p.role !== "STAFF") return null;
    const rows = await this.prisma.membershipLocation.findMany({
      where: { membership: { userId: p.sub, tenantId: p.tid } },
      select: { locationId: true },
    });
    return rows.length ? rows.map((r) => r.locationId) : null; // none assigned = all branches
  }
}
