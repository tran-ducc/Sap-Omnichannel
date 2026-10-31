import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { RoleKey } from "@omni/shared";
import type { Request } from "express";
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Phiên đăng nhập không hợp lệ");

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      req.user = { userId: payload.sub, tenantId: payload.tid, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }
  }
}
