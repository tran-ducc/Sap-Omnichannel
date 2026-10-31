import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { ROLE_KEYS, type RoleKey, type StaffMember, type TemporaryCredential } from "@omni/shared";
import * as bcrypt from "bcryptjs";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { randomInt } from "node:crypto";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { startOfVnMonth } from "../../common/time";
import { PrismaService } from "../../prisma/prisma.module";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class AddMemberDto {
  @Transform(trim) @IsString() @MinLength(2, { message: "Họ tên cần ít nhất 2 ký tự" }) @MaxLength(80) fullName: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value)) @IsEmail({}, { message: "Email không đúng định dạng" }) email: string;
  @IsOptional() @Transform(trim) @Matches(/^(0|\+84)\d{9,10}$/, { message: "Số điện thoại không hợp lệ" }) phone?: string;
  @IsIn(ROLE_KEYS, { message: "Vai trò không hợp lệ" }) role: RoleKey;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) locationIds?: string[];
}

class UpdateMemberDto {
  @IsOptional() @IsIn(ROLE_KEYS, { message: "Vai trò không hợp lệ" }) role?: RoleKey;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) locationIds?: string[];
  @IsOptional() @IsIn(["ACTIVE", "DISABLED"], { message: "Trạng thái không hợp lệ" }) status?: "ACTIVE" | "DISABLED";
}

/** Readable temporary password that satisfies the password policy (letters + digits, 10 chars). */
function temporaryPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz"; // no i, l, o: easy to read aloud
  const pick = (s: string) => s[randomInt(s.length)];
  return `Sap${Array.from({ length: 4 }, () => pick(letters)).join("")}${randomInt(100, 999)}`;
}

/** Who may manage whom: Admin → everyone; Manager → Staff only. */
const RANK: Record<RoleKey, number> = { ADMIN: 3, MANAGER: 2, STAFF: 1 };
const canManage = (actor: RoleKey, target: RoleKey) => actor === "ADMIN" || RANK[actor] > RANK[target];

@Injectable()
class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser): Promise<StaffMember[]> {
    const monthStart = startOfVnMonth(new Date());
    const [members, stats] = await Promise.all([
      this.prisma.membership.findMany({
        where: { tenantId: user.tenantId },
        include: { user: true, role: true, locations: true },
        orderBy: [{ status: "asc" }, { user: { fullName: "asc" } }],
      }),
      // POS sales rung up + online orders handled this month
      this.prisma.order.groupBy({
        by: ["createdById"],
        where: { tenantId: user.tenantId, placedAt: { gte: monthStart }, channelType: "POS", status: "COMPLETED", createdById: { not: null } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);
    const byUser = new Map(stats.map((s) => [s.createdById!, s]));
    return members.map((m) => this.toMember(m, user, byUser.get(m.userId)));
  }

  private toMember(
    m: { userId: string; status: "INVITED" | "ACTIVE" | "DISABLED"; role: { key: RoleKey | null }; locations: { locationId: string }[]; user: { fullName: string; email: string; phone: string | null; avatarUrl: string | null; lastLoginAt: Date | null } },
    actor: AuthUser,
    stat?: { _count: { _all: number }; _sum: { total: unknown } },
  ): StaffMember {
    const role = m.role.key ?? "STAFF";
    return {
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phone,
      avatarUrl: m.user.avatarUrl,
      role,
      status: m.status,
      locationIds: m.locations.map((l) => l.locationId),
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      ordersThisMonth: stat?._count._all ?? 0,
      revenueThisMonth: Number(stat?._sum.total ?? 0),
      isSelf: m.userId === actor.userId,
      editable: m.userId !== actor.userId && canManage(actor.role, role),
    };
  }

  private async member(user: AuthUser, userId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: user.tenantId } },
      include: { user: true, role: true, locations: true },
    });
    if (!m) throw new NotFoundException("Không tìm thấy nhân viên");
    return m;
  }

  private async roleId(tenantId: string, key: RoleKey) {
    const r = await this.prisma.role.findFirst({ where: { tenantId, key } });
    if (!r) throw new BadRequestException("Cửa hàng thiếu vai trò hệ thống");
    return r.id;
  }

  private async assertLocations(tenantId: string, ids: string[]) {
    if (ids.length && (await this.prisma.location.count({ where: { id: { in: ids }, tenantId } })) !== new Set(ids).size) {
      throw new NotFoundException("Có chi nhánh không thuộc cửa hàng");
    }
  }

  /** The shop must always keep at least one active Admin. */
  private async assertNotLastAdmin(tenantId: string, userId: string) {
    const admins = await this.prisma.membership.count({ where: { tenantId, status: "ACTIVE", role: { key: "ADMIN" }, userId: { not: userId } } });
    if (admins === 0) throw new BadRequestException("Cửa hàng cần ít nhất một Admin đang hoạt động");
  }

  async add(user: AuthUser, dto: AddMemberDto): Promise<TemporaryCredential> {
    if (!canManage(user.role, dto.role)) throw new ForbiddenException("Bạn chỉ được thêm nhân viên có vai trò thấp hơn mình");
    await this.assertLocations(user.tenantId, dto.locationIds ?? []);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { memberships: { where: { tenantId: user.tenantId } } } });
    if (existing?.memberships.length) throw new ConflictException("Người này đã có trong cửa hàng");

    const password = existing ? null : temporaryPassword();
    const roleId = await this.roleId(user.tenantId, dto.role);
    const userId = await this.prisma.$transaction(async (tx) => {
      const u = existing ?? (await tx.user.create({ data: { email: dto.email, fullName: dto.fullName, phone: dto.phone, passwordHash: await bcrypt.hash(password!, 10) } }));
      await tx.membership.create({
        data: { userId: u.id, tenantId: user.tenantId, roleId, locations: { create: (dto.locationIds ?? []).map((locationId) => ({ locationId })) } },
      });
      await tx.activityLog.create({
        data: { tenantId: user.tenantId, actorId: user.userId, action: "staff.added", entityType: "User", entityId: u.id, metadata: { name: u.fullName, role: dto.role } },
      });
      return u.id;
    });
    return { member: this.toMember(await this.member(user, userId), user), temporaryPassword: password };
  }

  async update(user: AuthUser, userId: string, dto: UpdateMemberDto): Promise<StaffMember> {
    if (userId === user.userId) throw new BadRequestException("Bạn không thể tự đổi vai trò hoặc khoá tài khoản của mình");
    const m = await this.member(user, userId);
    const current = m.role.key ?? "STAFF";
    if (!canManage(user.role, current) || (dto.role && !canManage(user.role, dto.role))) {
      throw new ForbiddenException("Bạn không có quyền thay đổi người này");
    }
    if (current === "ADMIN" && ((dto.role && dto.role !== "ADMIN") || dto.status === "DISABLED")) await this.assertNotLastAdmin(user.tenantId, userId);
    if (dto.locationIds) await this.assertLocations(user.tenantId, dto.locationIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: m.id },
        data: {
          ...(dto.role && { roleId: await this.roleId(user.tenantId, dto.role) }),
          ...(dto.status && { status: dto.status }),
          ...(dto.locationIds && { locations: { deleteMany: {}, create: dto.locationIds.map((locationId) => ({ locationId })) } }),
        },
      });
      // Locked out = signed out of this shop everywhere.
      if (dto.status === "DISABLED") {
        await tx.refreshToken.updateMany({ where: { userId, tenantId: user.tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.activityLog.create({
        data: { tenantId: user.tenantId, actorId: user.userId, action: "staff.updated", entityType: "User", entityId: userId, metadata: { name: m.user.fullName, ...dto } },
      });
    });
    return this.toMember(await this.member(user, userId), user);
  }

  async resetPassword(user: AuthUser, userId: string): Promise<TemporaryCredential> {
    if (userId === user.userId) throw new BadRequestException("Hãy đổi mật khẩu của mình trong phần tài khoản");
    const m = await this.member(user, userId);
    if (!canManage(user.role, m.role.key ?? "STAFF")) throw new ForbiddenException("Bạn không có quyền đặt lại mật khẩu người này");
    // An account shared with other shops is not this shop's to reset.
    const shops = await this.prisma.membership.count({ where: { userId } });
    if (shops > 1) throw new BadRequestException("Tài khoản này dùng chung cho nhiều cửa hàng, người dùng cần tự đổi mật khẩu");
    const password = temporaryPassword();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "staff.password_reset", entityType: "User", entityId: userId, metadata: { name: m.user.fullName } } }),
    ]);
    return { member: this.toMember(m, user), temporaryPassword: password };
  }
}

@Controller("staff")
class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermission("staff:read")
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user);
  }

  @Post()
  @RequirePermission("staff:manage")
  add(@CurrentUser() user: AuthUser, @Body() dto: AddMemberDto) {
    return this.staff.add(user, dto);
  }

  @Patch(":userId")
  @RequirePermission("staff:manage")
  update(@CurrentUser() user: AuthUser, @Param("userId") userId: string, @Body() dto: UpdateMemberDto) {
    return this.staff.update(user, userId, dto);
  }

  @Post(":userId/reset-password")
  @HttpCode(200)
  @RequirePermission("staff:manage")
  reset(@CurrentUser() user: AuthUser, @Param("userId") userId: string) {
    return this.staff.resetPassword(user, userId);
  }
}

@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
