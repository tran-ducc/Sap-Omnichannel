import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  can,
  type InventoryChangedEvent,
  type InventoryList,
  type InventoryMovementType,
  type MovementItem,
  type StockLevel,
} from "@omni/shared";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertInScope, locationSql, locationWhere } from "../../common/location-scope";
import type { AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { ChannelSyncService } from "../channels/channel-sync.service";
import { NotificationsService } from "../notifications/notifications.module";
import { RealtimeGateway } from "../realtime/realtime.module";
import type { AdjustReason, AdjustStockDto, InventoryQuery, TransferStockDto } from "./inventory.dto";

type Tx = Prisma.TransactionClient;

export interface MovementInput {
  tenantId: string;
  variantId: string;
  locationId: string;
  /** Signed change to on-hand stock. */
  delta: number;
  /** Signed change to reserved stock (orders placed but not shipped). */
  reservedDelta?: number;
  type: InventoryMovementType;
  note?: string | null;
  actorId?: string | null;
  referenceType?: string;
  referenceId?: string;
}

const REASON_NOTE: Record<AdjustReason, string> = {
  PURCHASE: "Nhập hàng",
  COUNT: "Kiểm kho",
  DAMAGE: "Hàng hỏng, mất",
  RETURN: "Khách trả hàng",
  OTHER: "Điều chỉnh khác",
};

const MAX_ATTEMPTS = 4;

export const toLevel = (l: { locationId: string; onHand: number; reserved: number; reorderPoint: number }): StockLevel => ({
  locationId: l.locationId,
  onHand: l.onHand,
  reserved: l.reserved,
  available: l.onHand - l.reserved,
  reorderPoint: l.reorderPoint,
});

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly channelSync: ChannelSyncService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The only way stock changes. Uses optimistic locking on `version`: two
   * channels selling the last unit at the same moment cannot both succeed —
   * the loser re-reads and fails the availability check. Every change writes
   * a ledger row in the same transaction.
   */
  async applyMovement(tx: Tx, m: MovementInput) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const level =
        (await tx.inventoryLevel.findUnique({ where: { variantId_locationId: { variantId: m.variantId, locationId: m.locationId } } })) ??
        (await tx.inventoryLevel.create({ data: { tenantId: m.tenantId, variantId: m.variantId, locationId: m.locationId } }));

      const next = level.onHand + m.delta;
      // Never let reserved go negative (e.g. history imported without reservations).
      const nextReserved = Math.max(0, level.reserved + (m.reservedDelta ?? 0));
      if (next < 0) throw new BadRequestException(`Không đủ hàng: chỉ còn ${level.onHand} sản phẩm tại kho này`);
      if (m.type === "RESERVE" && next - nextReserved < 0) {
        throw new BadRequestException(`Không đủ hàng để giữ: chỉ còn ${level.onHand - level.reserved} sản phẩm có thể bán tại kho này`);
      }
      if (next < nextReserved) {
        throw new BadRequestException(`Không thể giảm xuống ${next}: đang có ${level.reserved} sản phẩm được giữ cho đơn chưa giao`);
      }

      const { count } = await tx.inventoryLevel.updateMany({
        where: { id: level.id, version: level.version },
        data: { onHand: next, reserved: nextReserved, version: { increment: 1 } },
      });
      if (count === 0) continue; // someone else changed this row; re-read and retry

      await tx.inventoryMovement.create({
        data: {
          tenantId: m.tenantId,
          variantId: m.variantId,
          locationId: m.locationId,
          type: m.type,
          // Ledger quantity is the on-hand change; reservations record the reserved change.
          quantity: m.type === "RESERVE" || m.type === "RELEASE" ? (m.reservedDelta ?? 0) : m.delta,
          note: m.note ?? null,
          createdById: m.actorId ?? null,
          referenceType: m.referenceType,
          referenceId: m.referenceId,
        },
      });
      return { ...level, onHand: next, reserved: nextReserved, version: level.version + 1 };
    }
    throw new ConflictException("Tồn kho vừa được cập nhật ở nơi khác. Vui lòng thử lại.");
  }

  /** Broadcast committed changes, queue marketplace sync, alert on low stock. Call after the transaction. */
  async afterCommit(tenantId: string, changes: { variantId: string; level: StockLevel; type: InventoryMovementType; delta: number }[], actorId?: string | null) {
    const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } }) : null;
    for (const c of changes) {
      const event: InventoryChangedEvent = { variantId: c.variantId, level: c.level, movementType: c.type, quantity: c.delta, actorName: actor?.fullName ?? null };
      this.realtime.emitToTenant(tenantId, "inventory.changed", event);
    }
    await this.channelSync.schedule(
      tenantId,
      changes.map((c) => c.variantId),
    );
    await this.alertLowStock(tenantId, changes);
  }

  /** One alert per variant/location per 12h when sellable stock drops to the reorder point. */
  private async alertLowStock(tenantId: string, changes: { variantId: string; level: StockLevel; type: InventoryMovementType }[]) {
    const decreasing: InventoryMovementType[] = ["SALE", "RESERVE", "ADJUSTMENT", "TRANSFER_OUT"];
    const low = changes.filter((c) => decreasing.includes(c.type) && c.level.available <= c.level.reorderPoint);
    if (!low.length) return;
    const [variants, locations] = await Promise.all([
      this.prisma.productVariant.findMany({ where: { id: { in: low.map((c) => c.variantId) } }, select: { id: true, name: true, productId: true, product: { select: { name: true } } } }),
      this.prisma.location.findMany({ where: { id: { in: low.map((c) => c.level.locationId) } }, select: { id: true, name: true } }),
    ]);
    for (const c of low) {
      const v = variants.find((x) => x.id === c.variantId);
      const loc = locations.find((x) => x.id === c.level.locationId);
      if (!v || !loc) continue;
      await this.notifications.notify(tenantId, "inventory:adjust", {
        type: "stock.low",
        title: c.level.available <= 0 ? `Hết hàng: ${v.product.name}, ${v.name}` : `Sắp hết: ${v.product.name}, ${v.name}`,
        body: `${loc.name} còn ${Math.max(0, c.level.available)} sản phẩm có thể bán (mức tối thiểu ${c.level.reorderPoint}).`,
        href: `/app/products/${v.productId}`,
        dedupeKey: `${c.variantId}:${c.level.locationId}`,
      });
    }
  }

  async adjust(user: AuthUser, dto: AdjustStockDto) {
    assertInScope(user, dto.locationId);
    await this.assertOwned(user.tenantId, dto.variantId, [dto.locationId]);

    const result = await this.prisma.$transaction(async (tx) => {
      let delta: number;
      if (dto.mode === "set") {
        const current = await tx.inventoryLevel.findUnique({ where: { variantId_locationId: { variantId: dto.variantId, locationId: dto.locationId } } });
        delta = dto.quantity - (current?.onHand ?? 0);
        if (delta === 0) return null; // count matches the system: nothing to record
      } else {
        if (dto.quantity === 0) throw new BadRequestException("Số lượng điều chỉnh phải lớn hơn 0");
        delta = dto.mode === "add" ? dto.quantity : -dto.quantity;
      }
      const type: InventoryMovementType = dto.reason === "PURCHASE" && delta > 0 ? "PURCHASE" : dto.reason === "RETURN" && delta > 0 ? "RETURN" : "ADJUSTMENT";
      const note = [REASON_NOTE[dto.reason], dto.note?.trim()].filter(Boolean).join(": ");
      const level = await this.applyMovement(tx, { tenantId: user.tenantId, variantId: dto.variantId, locationId: dto.locationId, delta, type, note, actorId: user.userId });
      await tx.activityLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.userId,
          action: "inventory.adjusted",
          entityType: "ProductVariant",
          entityId: dto.variantId,
          metadata: { locationId: dto.locationId, delta, reason: dto.reason, onHand: level.onHand },
        },
      });
      return { level, delta, type };
    });

    if (!result) return { changed: false };
    await this.afterCommit(user.tenantId, [{ variantId: dto.variantId, level: toLevel(result.level), type: result.type, delta: result.delta }], user.userId);
    return { changed: true, level: toLevel(result.level) };
  }

  async transfer(user: AuthUser, dto: TransferStockDto) {
    if (dto.fromLocationId === dto.toLocationId) throw new BadRequestException("Kho chuyển đi và kho nhận phải khác nhau");
    assertInScope(user, dto.fromLocationId, dto.toLocationId);
    await this.assertOwned(user.tenantId, dto.variantId, [dto.fromLocationId, dto.toLocationId]);
    const referenceId = randomUUID();
    const note = dto.note?.trim() || null;

    const [from, to] = await this.prisma.$transaction(async (tx) => {
      const src = await tx.inventoryLevel.findUnique({ where: { variantId_locationId: { variantId: dto.variantId, locationId: dto.fromLocationId } } });
      const available = (src?.onHand ?? 0) - (src?.reserved ?? 0);
      if (dto.quantity > available) throw new BadRequestException(`Kho chuyển đi chỉ còn ${available} sản phẩm có thể chuyển`);
      const common = { tenantId: user.tenantId, variantId: dto.variantId, note, actorId: user.userId, referenceType: "Transfer", referenceId };
      const a = await this.applyMovement(tx, { ...common, locationId: dto.fromLocationId, delta: -dto.quantity, type: "TRANSFER_OUT" });
      const b = await this.applyMovement(tx, { ...common, locationId: dto.toLocationId, delta: dto.quantity, type: "TRANSFER_IN" });
      await tx.activityLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.userId,
          action: "inventory.transferred",
          entityType: "ProductVariant",
          entityId: dto.variantId,
          metadata: { from: dto.fromLocationId, to: dto.toLocationId, quantity: dto.quantity },
        },
      });
      return [a, b];
    });

    await this.afterCommit(
      user.tenantId,
      [
        { variantId: dto.variantId, level: toLevel(from), type: "TRANSFER_OUT", delta: -dto.quantity },
        { variantId: dto.variantId, level: toLevel(to), type: "TRANSFER_IN", delta: dto.quantity },
      ],
      user.userId,
    );
    return { from: toLevel(from), to: toLevel(to) };
  }

  async list(user: AuthUser, q: InventoryQuery): Promise<InventoryList> {
    const search = q.q?.trim();
    // Restricted staff only see (and filter by) their own branches.
    const levelScope: Prisma.InventoryLevelWhereInput = locationWhere(user, q.locationId);
    const where: Prisma.ProductVariantWhereInput = {
      tenantId: user.tenantId,
      isActive: true,
      product: { deletedAt: null, status: { not: "ARCHIVED" } },
      ...(search && {
        OR: [
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search } },
          { name: { contains: search, mode: "insensitive" } },
          { product: { name: { contains: search, mode: "insensitive" } } },
        ],
      }),
      // Field reference: compare each row's on-hand with its own reorder point.
      ...(q.lowStock && { inventory: { some: { ...levelScope, onHand: { lte: this.prisma.inventoryLevel.fields.reorderPoint } } } }),
    };

    const [total, variants, summary] = await Promise.all([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          product: { select: { id: true, name: true, category: { select: { name: true } } } },
          inventory: { where: levelScope },
          listings: { include: { channel: { select: { type: true } } } },
        },
      }),
      this.summary(user, q.locationId),
    ]);

    return {
      total,
      page: q.page,
      limit: q.limit,
      summary,
      items: variants.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        variantName: v.name,
        sku: v.sku,
        category: v.product.category?.name ?? null,
        price: Number(v.price),
        levels: v.inventory.map(toLevel),
        listings: v.listings.map((l) => ({
          channelType: l.channel.type,
          syncStatus: l.syncStatus,
          lastSyncedAt: l.lastSyncedAt?.toISOString() ?? null,
          lastError: l.lastError,
        })),
      })),
    };
  }

  private async summary(user: AuthUser, locationId?: string) {
    const loc = locationSql(user, Prisma.sql`il."locationId"`, locationId);
    const [row] = await this.prisma.$queryRaw<{ sku: number; on_hand: number; low: number; out: number; value: number }[]>`
      SELECT COUNT(DISTINCT v.id)::int AS sku,
             COALESCE(SUM(il."onHand"), 0)::int AS on_hand,
             COUNT(*) FILTER (WHERE il."onHand" - il.reserved > 0 AND il."onHand" <= il."reorderPoint")::int AS low,
             COUNT(*) FILTER (WHERE il."onHand" - il.reserved <= 0)::int AS out,
             COALESCE(SUM(il."onHand" * COALESCE(v."costPrice", 0)), 0)::float AS value
      FROM "InventoryLevel" il
      JOIN "ProductVariant" v ON v.id = il."variantId"
      JOIN "Product" p ON p.id = v."productId"
      WHERE il."tenantId" = ${user.tenantId} AND v."isActive" AND p."deletedAt" IS NULL AND p.status <> 'ARCHIVED' ${loc}`;
    return {
      skuCount: row?.sku ?? 0,
      totalOnHand: row?.on_hand ?? 0,
      lowStock: row?.low ?? 0,
      outOfStock: row?.out ?? 0,
      // Cost is management information.
      stockValue: can(user.role, "product:update_price") ? (row?.value ?? 0) : null,
    };
  }

  async movements(user: AuthUser, variantId: string): Promise<MovementItem[]> {
    await this.assertOwned(user.tenantId, variantId, []);
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { tenantId: user.tenantId, variantId, ...locationWhere(user) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { location: { select: { name: true } }, createdBy: { select: { fullName: true } } },
    });
    const orderIds = rows.filter((r) => r.referenceType === "Order" && r.referenceId).map((r) => r.referenceId!);
    const orders = orderIds.length ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, code: true } }) : [];
    const code = new Map(orders.map((o) => [o.id, o.code]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      quantity: r.quantity,
      locationId: r.locationId,
      locationName: r.location.name,
      note: r.note,
      referenceType: r.referenceType,
      referenceCode: r.referenceId ? (code.get(r.referenceId) ?? null) : null,
      actorName: r.createdBy?.fullName ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Ids in the request body are untrusted: make sure they belong to the caller's shop. */
  private async assertOwned(tenantId: string, variantId: string, locationIds: string[]) {
    const [variant, locations] = await Promise.all([
      this.prisma.productVariant.findFirst({ where: { id: variantId, tenantId }, select: { id: true } }),
      locationIds.length ? this.prisma.location.count({ where: { id: { in: locationIds }, tenantId, isActive: true } }) : Promise.resolve(0),
    ]);
    if (!variant) throw new NotFoundException("Không tìm thấy mẫu sản phẩm");
    if (locationIds.length && locations !== new Set(locationIds).size) throw new NotFoundException("Không tìm thấy chi nhánh hoặc kho");
  }
}
