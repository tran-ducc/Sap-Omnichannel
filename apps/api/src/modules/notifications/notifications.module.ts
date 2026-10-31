import { Controller, Get, Global, HttpCode, Injectable, Logger, Module, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ROLE_PERMISSIONS, type ActivityItem, type NotificationItem, type NotificationList, type NotificationType, type Page, type Permission, type RoleKey } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { RealtimeGateway } from "../realtime/realtime.module";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  /** Skip if the same key was notified within `dedupeHours` (e.g. one low-stock alert per variant/location). */
  dedupeKey?: string;
  dedupeHours?: number;
}

const toItem = (n: { id: string; type: string; title: string; body: string | null; data: Prisma.JsonValue; readAt: Date | null; createdAt: Date }): NotificationItem => ({
  id: n.id,
  type: n.type as NotificationType,
  title: n.title,
  body: n.body,
  href: ((n.data as { href?: string } | null)?.href as string | undefined) ?? null,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

/**
 * In-app notifications. Each eligible user gets their own row (read state is
 * personal), chosen by permission so e.g. low-stock alerts reach whoever can
 * restock. Never throws: a failed notification must not fail the business
 * action that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async notify(tenantId: string, audience: Permission, input: NotifyInput) {
    try {
      if (input.dedupeKey) {
        const since = new Date(Date.now() - (input.dedupeHours ?? 12) * 3_600_000);
        const recent = await this.prisma.notification.count({
          where: { tenantId, type: input.type, createdAt: { gte: since }, data: { path: ["dedupeKey"], equals: input.dedupeKey } },
        });
        if (recent) return;
      }
      const members = await this.prisma.membership.findMany({
        where: { tenantId, status: "ACTIVE", user: { isActive: true } },
        select: { userId: true, role: { select: { key: true } } },
      });
      const userIds = members.filter((m) => ROLE_PERMISSIONS[(m.role.key ?? "STAFF") as RoleKey].includes(audience)).map((m) => m.userId);
      if (!userIds.length) return;
      const data = { href: input.href ?? null, dedupeKey: input.dedupeKey ?? null };
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ tenantId, userId, type: input.type, title: input.title, body: input.body, data })),
      });
      this.realtime.emitToUsers(userIds, "notification.created", { type: input.type, title: input.title, body: input.body ?? null, href: input.href ?? null });
    } catch (e) {
      this.logger.warn(`Notification "${input.type}" not sent: ${(e as Error).message}`);
    }
  }

  async list(user: AuthUser, unreadOnly: boolean, limit: number): Promise<NotificationList> {
    const where = { tenantId: user.tenantId, userId: user.userId };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { ...where, ...(unreadOnly && { readAt: null }) }, orderBy: { createdAt: "desc" }, take: limit }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items: items.map(toItem), unread };
  }

  async markRead(user: AuthUser, id: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { id, tenantId: user.tenantId, userId: user.userId, readAt: null }, data: { readAt: new Date() } });
    if (!count && !(await this.prisma.notification.count({ where: { id, userId: user.userId } }))) throw new NotFoundException("Không tìm thấy thông báo");
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { tenantId: user.tenantId, userId: user.userId, readAt: null }, data: { readAt: new Date() } });
  }
}

class NotificationQuery {
  @IsOptional() @Transform(({ value }) => value === true || value === "true" || value === "1") @IsBoolean() unread?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}

@Controller("notifications")
class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: NotificationQuery) {
    return this.notifications.list(user, !!q.unread, q.limit);
  }

  @Post("read-all")
  @HttpCode(204)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(":id/read")
  @HttpCode(204)
  read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notifications.markRead(user, id);
  }
}

class ActivityQuery {
  @IsOptional() @IsString() @MaxLength(40) entityType?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() @MaxLength(60) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

@Controller("activity")
class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("activity:read")
  async list(@CurrentUser() user: AuthUser, @Query() q: ActivityQuery): Promise<Page<ActivityItem>> {
    const where: Prisma.ActivityLogWhereInput = {
      tenantId: user.tenantId,
      ...(q.entityType && { entityType: q.entityType }),
      ...(q.actorId && { actorId: q.actorId }),
      ...(q.action && { action: { startsWith: q.action } }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { actor: { select: { id: true, fullName: true } } },
      }),
    ]);
    return {
      total,
      page: q.page,
      limit: q.limit,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: r.actor,
        metadata: (r.metadata as Record<string, unknown>) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}

@Global()
@Module({
  controllers: [NotificationsController, ActivityController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
