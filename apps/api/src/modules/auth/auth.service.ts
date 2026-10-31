import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ROLE_KEYS, ROLE_PERMISSIONS, type AuthSession, type RoleKey } from "@omni/shared";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { AccessTokenPayload } from "../../common/auth.guard";
import { PrismaService } from "../../prisma/prisma.module";
import type { LoginDto, RegisterDto } from "./auth.dto";

const ROLE_NAMES: Record<RoleKey, string> = { ADMIN: "Admin", MANAGER: "Quản lý", STAFF: "Nhân viên" };
const BCRYPT_ROUNDS = 11;

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a shop (tenant) with its three system roles, a default store,
   * a POS channel and the owner as Admin — all in one transaction.
   */
  async register(dto: RegisterDto, userAgent?: string): Promise<IssuedSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email này đã được dùng. Hãy đăng nhập hoặc dùng email khác.");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = `${slugify(dto.shopName) || "shop"}-${randomBytes(3).toString("hex")}`;

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.shopName, slug, trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000) },
      });
      const roles = await Promise.all(
        ROLE_KEYS.map((key) =>
          tx.role.create({ data: { tenantId: tenant.id, key, name: ROLE_NAMES[key], permissions: [...ROLE_PERMISSIONS[key]], isSystem: true } }),
        ),
      );
      const user = await tx.user.create({ data: { email: dto.email, passwordHash, fullName: dto.fullName, phone: dto.phone } });
      await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, roleId: roles.find((r) => r.key === "ADMIN")!.id } });
      const store = await tx.location.create({ data: { tenantId: tenant.id, name: "Cửa hàng chính", code: "CN01" } });
      await tx.channel.create({ data: { tenantId: tenant.id, type: "POS", name: "Bán tại quầy", status: "CONNECTED", defaultLocationId: store.id } });
      await tx.activityLog.create({ data: { tenantId: tenant.id, actorId: user.id, action: "tenant.created", entityType: "Tenant", entityId: tenant.id } });
      return { user, tenant };
    });

    return this.issue(user.id, tenant.id, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { memberships: { where: { status: "ACTIVE" }, include: { tenant: true }, orderBy: { createdAt: "asc" } } },
    });
    // Same message for unknown email and wrong password: don't reveal which accounts exist.
    const ok = user && user.isActive && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!ok) throw new UnauthorizedException("Email hoặc mật khẩu không đúng");

    const membership = dto.tenantSlug ? user.memberships.find((m) => m.tenant.slug === dto.tenantSlug) : user.memberships[0];
    if (!membership) throw new ForbiddenException("Tài khoản chưa thuộc cửa hàng nào hoặc đã bị khoá");
    if (membership.tenant.status === "SUSPENDED") throw new ForbiddenException("Cửa hàng đang tạm khoá. Liên hệ chủ cửa hàng.");

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.activityLog.create({ data: { tenantId: membership.tenantId, actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip } }),
    ]);
    return this.issue(user.id, membership.tenantId, userAgent);
  }

  /**
   * Rotates the refresh token. Presenting a token that was already rotated
   * means it leaked (or was replayed), so every session of that user is
   * revoked and they must log in again.
   */
  async refresh(rawToken: string | undefined, userAgent?: string): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException("Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.");
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issue(stored.userId, stored.tenantId, userAgent);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Signs out every other session: a password change usually means "someone else may know it". */
  async changePassword(userId: string, currentPassword: string, newPassword: string, keepTokenHash?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    if (currentPassword === newPassword) throw new ConflictException("Mật khẩu mới phải khác mật khẩu hiện tại");
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...(keepTokenHash && { tokenHash: { not: keepTokenHash } }) },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  hashToken(raw: string | undefined) {
    return raw ? sha256(raw) : undefined;
  }

  async me(userId: string, tenantId: string): Promise<Omit<AuthSession, "accessToken">> {
    const { session } = await this.buildSession(userId, tenantId);
    return session;
  }

  // -------------------------------------------------------------------------

  private async buildSession(userId: string, tenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: true, tenant: true, role: true, locations: true },
    });
    if (!membership || membership.status !== "ACTIVE" || !membership.user.isActive) {
      throw new UnauthorizedException("Tài khoản không còn quyền truy cập cửa hàng này");
    }
    // Custom roles (no key) fall back to Staff-level access until they are supported in the UI.
    const role: RoleKey = membership.role.key ?? "STAFF";
    const session: Omit<AuthSession, "accessToken"> = {
      user: { id: membership.user.id, email: membership.user.email, fullName: membership.user.fullName, avatarUrl: membership.user.avatarUrl },
      tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug, plan: membership.tenant.plan },
      role,
      permissions: [...ROLE_PERMISSIONS[role]],
      locationIds: membership.locations.map((l) => l.locationId),
    };
    return { session, role };
  }

  private async issue(userId: string, tenantId: string, userAgent?: string): Promise<IssuedSession> {
    const { session, role } = await this.buildSession(userId, tenantId);
    const payload: AccessTokenPayload = { sub: userId, tid: tenantId, role };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString("base64url");
    const days = Number(this.config.get("JWT_REFRESH_TTL_DAYS") ?? 30);
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);
    try {
      await this.prisma.refreshToken.create({
        data: { userId, tenantId, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt, userAgent: userAgent?.slice(0, 255) },
      });
    } catch (e) {
      // A hash collision is practically impossible; surface anything else.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return this.issue(userId, tenantId, userAgent);
      throw e;
    }
    return { session: { ...session, accessToken }, refreshToken, refreshExpiresAt };
  }
}
