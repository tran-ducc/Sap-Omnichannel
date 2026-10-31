import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { AuthSession } from "@omni/shared";
import type { CookieOptions, Request, Response } from "express";
import { CurrentUser, Public } from "../../common/auth.guard";
import type { AuthUser } from "../../common/permissions.guard";
import { ChangePasswordDto, LoginDto, RegisterDto } from "./auth.dto";
import { AuthService, type IssuedSession } from "./auth.service";

/**
 * The refresh token lives only in an httpOnly cookie scoped to /api/v1/auth,
 * so page scripts can never read it. The short-lived access token is
 * returned in the body and kept in memory by the web app.
 */
const REFRESH_COOKIE = "omni_rt";
const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax", // web (:3000) and api (:4000) on localhost are same-site
  secure: process.env.NODE_ENV === "production",
  path: "/api/v1/auth",
  expires,
});

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    return this.respond(res, await this.auth.register(dto, req.headers["user-agent"]));
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    return this.respond(res, await this.auth.login(dto, req.headers["user-agent"], req.ip));
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    try {
      return this.respond(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], req.headers["user-agent"]));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw e;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId, user.tenantId);
  }

  /** Keeps the current device signed in; every other session is revoked. */
  @Post("change-password")
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    await this.auth.changePassword(user.userId, dto.currentPassword, dto.newPassword, this.auth.hashToken(req.cookies?.[REFRESH_COOKIE]));
  }

  private respond(res: Response, issued: IssuedSession): AuthSession {
    res.cookie(REFRESH_COOKIE, issued.refreshToken, cookieOptions(issued.refreshExpiresAt));
    return issued.session;
  }
}
