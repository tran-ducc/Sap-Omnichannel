import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import type { ChannelDetail, LocationDetail, StoreSettings } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { ChannelSyncService } from "../channels/channel-sync.service";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class StoreDto {
  @Transform(trim) @IsString() @MinLength(2, { message: "Tên cửa hàng cần ít nhất 2 ký tự" }) @MaxLength(80) name: string;
}

class CreateLocationDto {
  @Transform(trim) @IsString() @MinLength(2, { message: "Tên chi nhánh cần ít nhất 2 ký tự" }) @MaxLength(80) name: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,12}$/, { message: "Mã chi nhánh gồm 2–12 chữ in hoa, số hoặc gạch ngang" })
  code: string;
  @IsIn(["STORE", "WAREHOUSE"], { message: "Loại địa điểm không hợp lệ" }) type: "STORE" | "WAREHOUSE";
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @Transform(trim) @Matches(/^[0-9 +.-]{8,20}$/, { message: "Số điện thoại không hợp lệ" }) phone?: string;
}

class UpdateLocationDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2, { message: "Tên chi nhánh cần ít nhất 2 ký tự" }) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @Transform(trim) @Matches(/^[0-9 +.-]{8,20}$/, { message: "Số điện thoại không hợp lệ" }) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateChannelDto {
  @IsOptional() @IsIn(["CONNECTED", "DISCONNECTED"]) status?: "CONNECTED" | "DISCONNECTED";
  @IsOptional() @IsString() defaultLocationId?: string;
}

class DeleteStoreDto {
  @IsString() confirmName: string;
}

@Injectable()
class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channelSync: ChannelSyncService,
  ) {}

  async store(user: AuthUser): Promise<StoreSettings> {
    const t = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      include: { _count: { select: { locations: true, channels: true, memberships: true, products: { where: { deletedAt: null } } } } },
    });
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      currency: t.currency,
      timezone: t.timezone,
      trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      counts: { locations: t._count.locations, channels: t._count.channels, members: t._count.memberships, products: t._count.products },
    };
  }

  async updateStore(user: AuthUser, dto: StoreDto) {
    await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id: user.tenantId }, data: { name: dto.name } }),
      this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "settings.store_updated", entityType: "Tenant", entityId: user.tenantId, metadata: { name: dto.name } } }),
    ]);
    return this.store(user);
  }

  async locations(user: AuthUser): Promise<LocationDetail[]> {
    const [rows, stock] = await Promise.all([
      this.prisma.location.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ isActive: "desc" }, { type: "asc" }, { code: "asc" }] }),
      this.prisma.inventoryLevel.groupBy({ by: ["locationId"], where: { tenantId: user.tenantId }, _sum: { onHand: true } }),
    ]);
    const units = new Map(stock.map((s) => [s.locationId, s._sum.onHand ?? 0]));
    return rows.map((l) => ({ id: l.id, name: l.name, code: l.code, type: l.type, address: l.address, phone: l.phone, isActive: l.isActive, stockUnits: units.get(l.id) ?? 0 }));
  }

  async createLocation(user: AuthUser, dto: CreateLocationDto) {
    try {
      const l = await this.prisma.location.create({ data: { tenantId: user.tenantId, ...dto } });
      await this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "settings.location_created", entityType: "Location", entityId: l.id, metadata: { name: l.name } } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("Mã chi nhánh đã được dùng");
      throw e;
    }
    return this.locations(user);
  }

  async updateLocation(user: AuthUser, id: string, dto: UpdateLocationDto) {
    const l = await this.prisma.location.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!l) throw new NotFoundException("Không tìm thấy chi nhánh");
    if (dto.isActive === false) {
      // A location still in use can't disappear from under stock, cashiers or channels.
      const [units, openShifts, channels] = await Promise.all([
        this.prisma.inventoryLevel.aggregate({ where: { locationId: id }, _sum: { onHand: true } }),
        this.prisma.posSession.count({ where: { locationId: id, closedAt: null } }),
        this.prisma.channel.count({ where: { defaultLocationId: id, status: "CONNECTED" } }),
      ]);
      if ((units._sum.onHand ?? 0) > 0) throw new BadRequestException(`Còn ${units._sum.onHand} sản phẩm tồn tại đây. Chuyển hết hàng sang kho khác trước khi ngừng hoạt động.`);
      if (openShifts) throw new BadRequestException("Đang có ca bán hàng mở tại đây");
      if (channels) throw new BadRequestException("Đây đang là kho xuất hàng của kênh bán. Đổi kho cho kênh trước.");
    }
    await this.prisma.$transaction([
      this.prisma.location.update({ where: { id }, data: dto }),
      this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "settings.location_updated", entityType: "Location", entityId: id, metadata: { name: l.name, ...dto } } }),
    ]);
    return this.locations(user);
  }

  async channels(user: AuthUser): Promise<ChannelDetail[]> {
    const rows = await this.prisma.channel.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { listings: true } }, listings: { where: { syncStatus: "FAILED" }, select: { id: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      status: c.status,
      defaultLocationId: c.defaultLocationId,
      lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      listings: c._count.listings,
      failedListings: c.listings.length,
    }));
  }

  async updateChannel(user: AuthUser, id: string, dto: UpdateChannelDto) {
    const c = await this.prisma.channel.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!c) throw new NotFoundException("Không tìm thấy kênh bán");
    if (c.type === "POS" && dto.status === "DISCONNECTED") throw new BadRequestException("Không thể ngắt kênh bán tại quầy");
    if (dto.defaultLocationId && !(await this.prisma.location.count({ where: { id: dto.defaultLocationId, tenantId: user.tenantId, isActive: true } }))) {
      throw new NotFoundException("Không tìm thấy kho");
    }
    await this.prisma.$transaction([
      this.prisma.channel.update({ where: { id }, data: dto }),
      this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "settings.channel_updated", entityType: "Channel", entityId: id, metadata: { name: c.name, ...dto } } }),
    ]);
    // Reconnecting or moving the fulfilment location changes what each listing should show: push it now.
    if (dto.status === "CONNECTED" || dto.defaultLocationId) {
      const variants = await this.prisma.channelListing.findMany({ where: { channelId: id }, select: { variantId: true } });
      await this.channelSync.schedule(user.tenantId, variants.map((v) => v.variantId));
    }
    return this.channels(user);
  }

  /** Irreversible: removes the shop and everything in it. The exact name must be typed to confirm. */
  async deleteStore(user: AuthUser, dto: DeleteStoreDto) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    if (dto.confirmName.trim() !== t.name) throw new BadRequestException("Tên cửa hàng nhập lại không khớp");
    await this.prisma.tenant.delete({ where: { id: t.id } });
  }
}

@Controller("settings")
class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("store")
  @RequirePermission("settings:store")
  store(@CurrentUser() user: AuthUser) {
    return this.settings.store(user);
  }

  @Patch("store")
  @RequirePermission("settings:store")
  updateStore(@CurrentUser() user: AuthUser, @Body() dto: StoreDto) {
    return this.settings.updateStore(user, dto);
  }

  @Delete("store")
  @HttpCode(204)
  @RequirePermission("tenant:delete")
  deleteStore(@CurrentUser() user: AuthUser, @Body() dto: DeleteStoreDto) {
    return this.settings.deleteStore(user, dto);
  }

  @Get("locations")
  @RequirePermission("settings:store")
  locations(@CurrentUser() user: AuthUser) {
    return this.settings.locations(user);
  }

  @Post("locations")
  @RequirePermission("location:manage")
  createLocation(@CurrentUser() user: AuthUser, @Body() dto: CreateLocationDto) {
    return this.settings.createLocation(user, dto);
  }

  @Patch("locations/:id")
  @RequirePermission("location:manage")
  updateLocation(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateLocationDto) {
    return this.settings.updateLocation(user, id, dto);
  }

  @Get("channels")
  @RequirePermission("channel:manage")
  channels(@CurrentUser() user: AuthUser) {
    return this.settings.channels(user);
  }

  @Patch("channels/:id")
  @RequirePermission("channel:manage")
  updateChannel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateChannelDto) {
    return this.settings.updateChannel(user, id, dto);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
