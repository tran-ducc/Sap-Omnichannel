import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  can,
  ORDER_TRANSITIONS,
  TRANSITION_PERMISSION,
  type ChannelType,
  type InventoryMovementType,
  type OrderDetail,
  type OrderEvent,
  type OrderList,
  type OrderStatus,
  type StockLevel,
} from "@omni/shared";
import { Prisma } from "@prisma/client";
import { assertInScope, locationWhere } from "../../common/location-scope";
import { loyaltyPointsFor, POS_CHECKOUT_REF_PREFIX } from "../../common/loyalty";
import type { AuthUser } from "../../common/permissions.guard";
import { startOfVnDay } from "../../common/time";
import { PrismaService } from "../../prisma/prisma.module";
import { InventoryService, toLevel } from "../inventory/inventory.service";
import { NotificationsService } from "../notifications/notifications.module";
import { RealtimeGateway } from "../realtime/realtime.module";
import { nextOrderCode } from "./order-code";
import type { CreateOrderDto, OrderQuery, UpdateStatusDto } from "./orders.dto";

type Tx = Prisma.TransactionClient;
type StockChange = { variantId: string; level: StockLevel; type: InventoryMovementType; delta: number };

/** Where an order came from. Marketplace imports carry their own prices and ids. */
export interface OrderSource {
  kind: "manual" | "marketplace";
  externalOrderId?: string;
}

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));
const PRE_SHIP: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING"];
const person = (u: { id: string; fullName: string; avatarUrl: string | null } | null) => (u ? { id: u.id, fullName: u.fullName, avatarUrl: u.avatarUrl } : null);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Staff see orders they created or were assigned; managers see everything.
   * Branch-limited staff additionally only see orders of their branches (orders
   * without a locationId drop out, since `in` never matches null).
   */
  private scope(user: AuthUser): Prisma.OrderWhereInput {
    const own: Prisma.OrderWhereInput = can(user.role, "order:read_all") ? {} : { OR: [{ createdById: user.userId }, { assignedToId: user.userId }] };
    return { tenantId: user.tenantId, ...own, ...locationWhere(user) };
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async list(user: AuthUser, q: OrderQuery): Promise<OrderList> {
    const search = q.q?.trim();
    const base: Prisma.OrderWhereInput = {
      AND: [
        this.scope(user),
        q.range && q.range !== "all" ? { placedAt: { gte: startOfVnDay(new Date(), q.range === "today" ? 0 : q.range === "7d" ? -6 : -29) } } : {},
        q.assigned === "me" ? { assignedToId: user.userId } : {},
        search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { externalOrderId: { contains: search, mode: "insensitive" } },
                { customer: { fullName: { contains: search, mode: "insensitive" } } },
                { customer: { phone: { contains: search } } },
              ],
            }
          : {},
      ],
    };
    const where: Prisma.OrderWhereInput = { AND: [base, q.channel ? { channelType: q.channel } : {}, q.status ? { status: q.status } : {}] };

    const [total, orders, byStatus, byChannel] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          customer: { select: { fullName: true, phone: true } },
          assignedTo: { select: { id: true, fullName: true, avatarUrl: true } },
          _count: { select: { items: true } },
        },
      }),
      // Tab counts ignore the status filter; chip counts ignore the channel filter.
      this.prisma.order.groupBy({ by: ["status"], where: { AND: [base, q.channel ? { channelType: q.channel } : {}] }, _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ["channelType"], where: { AND: [base, q.status ? { status: q.status } : {}] }, _count: { _all: true } }),
    ]);

    const statusCounts: OrderList["counts"]["byStatus"] = { ALL: byStatus.reduce((s, r) => s + r._count._all, 0) };
    for (const r of byStatus) statusCounts[r.status] = r._count._all;
    const channelCounts: OrderList["counts"]["byChannel"] = {};
    for (const r of byChannel) channelCounts[r.channelType] = r._count._all;

    return {
      total,
      page: q.page,
      limit: q.limit,
      counts: { byStatus: statusCounts, byChannel: channelCounts },
      items: orders.map((o) => ({
        id: o.id,
        code: o.code,
        channelType: o.channelType,
        externalOrderId: o.externalOrderId,
        customerName: o.customer?.fullName ?? null,
        customerPhone: o.customer?.phone ?? null,
        itemCount: o._count.items,
        total: num(o.total),
        status: o.status,
        paymentStatus: o.paymentStatus,
        assignedTo: person(o.assignedTo),
        placedAt: o.placedAt.toISOString(),
      })),
    };
  }

  async get(user: AuthUser, id: string): Promise<OrderDetail> {
    const o = await this.prisma.order.findFirst({
      where: { AND: [this.scope(user), { id }] },
      include: {
        channel: { select: { name: true } },
        customer: true,
        location: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, avatarUrl: true } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        items: { include: { variant: { select: { productId: true } } } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    });
    if (!o) throw new NotFoundException("Không tìm thấy đơn hàng");
    const logs = await this.prisma.activityLog.findMany({
      where: { tenantId: user.tenantId, entityType: "Order", entityId: id },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { fullName: true } } },
    });

    return {
      id: o.id,
      code: o.code,
      channelType: o.channelType,
      channelName: o.channel.name,
      externalOrderId: o.externalOrderId,
      status: o.status,
      paymentStatus: o.paymentStatus,
      subtotal: num(o.subtotal),
      discountTotal: num(o.discountTotal),
      shippingFee: num(o.shippingFee),
      total: num(o.total),
      note: o.note,
      cancelReason: o.cancelReason,
      shippingAddress: (o.shippingAddress as OrderDetail["shippingAddress"]) ?? null,
      customer: o.customer ? { id: o.customer.id, fullName: o.customer.fullName, phone: o.customer.phone, orderCount: o.customer.orderCount, totalSpent: num(o.customer.totalSpent) } : null,
      location: o.location,
      assignedTo: person(o.assignedTo),
      createdBy: person(o.createdBy),
      items: o.items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        productId: i.variant?.productId ?? null,
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: num(i.unitPrice),
        discount: num(i.discount),
        total: num(i.total),
      })),
      payments: o.payments.map((p) => ({ id: p.id, method: p.method, amount: num(p.amount), paidAt: p.paidAt.toISOString() })),
      timeline: [
        // Seeded/imported orders may predate the activity log: synthesize their creation entry.
        ...(logs.some((l) => l.action === "order.created") ? [] : [{ id: `${o.id}-placed`, action: "order.created", actorName: null, at: o.placedAt.toISOString(), metadata: null }]),
        ...logs.map((l) => ({ id: l.id, action: l.action, actorName: l.actor?.fullName ?? null, at: l.createdAt.toISOString(), metadata: (l.metadata as Record<string, unknown>) ?? null })),
      ],
      stockReserved: !!o.stockReservedAt,
      stockDeducted: !!o.stockDeductedAt,
      placedAt: o.placedAt.toISOString(),
      allowedTransitions: ORDER_TRANSITIONS[o.status].filter((s) => can(user.role, TRANSITION_PERMISSION[s])),
    };
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  /**
   * Single entry point for new orders: manual entry (inbox, phone) and
   * marketplace imports. Reserves stock at the fulfilment location in the
   * same transaction, so an order can never be accepted for stock that is
   * already promised elsewhere.
   */
  async create(user: AuthUser | null, tenantId: string, dto: CreateOrderDto, source: OrderSource = { kind: "manual" }) {
    const actorId = user?.userId ?? null;
    const channel = await this.prisma.channel.findFirst({ where: { tenantId, type: dto.channelType } });
    if (!channel) throw new BadRequestException("Cửa hàng chưa kết nối kênh bán này");
    const locationId = dto.locationId ?? channel.defaultLocationId;
    if (!locationId || !(await this.prisma.location.count({ where: { id: locationId, tenantId, isActive: true } }))) {
      throw new BadRequestException("Chọn kho xuất hàng cho đơn");
    }
    if (user) assertInScope(user, locationId);

    const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, tenantId, isActive: true, product: { deletedAt: null, status: "ACTIVE" } },
      include: { product: { select: { name: true } } },
    });
    if (variants.length !== variantIds.length) throw new BadRequestException("Có sản phẩm không còn bán hoặc không thuộc cửa hàng");
    const byId = new Map(variants.map((v) => [v.id, v]));

    const canPrice = source.kind === "marketplace" || (user && can(user.role, "product:update_price"));
    if (user && source.kind === "manual" && (dto.discountTotal ?? 0) > 0 && !can(user.role, "pos:discount")) {
      throw new ForbiddenException("Vai trò của bạn không được giảm giá đơn hàng");
    }
    if (user && source.kind === "manual" && dto.items.some((i) => i.unitPrice !== undefined) && !canPrice) {
      throw new ForbiddenException("Vai trò của bạn không được sửa giá bán");
    }

    if (dto.customerId && !(await this.prisma.customer.count({ where: { id: dto.customerId, tenantId } }))) {
      throw new NotFoundException("Không tìm thấy khách hàng");
    }
    if (dto.assignedToId && !(await this.prisma.membership.count({ where: { userId: dto.assignedToId, tenantId, status: "ACTIVE" } }))) {
      throw new NotFoundException("Nhân viên được phân công không thuộc cửa hàng");
    }

    const lines = dto.items.map((i) => {
      const v = byId.get(i.variantId)!;
      const unitPrice = canPrice && i.unitPrice !== undefined ? i.unitPrice : Number(v.price);
      // unitCost snapshots today's cost price so later cost changes don't rewrite past profit.
      return { variantId: v.id, sku: v.sku, name: `${v.product.name}, ${v.name}`, quantity: i.quantity, unitPrice, unitCost: v.costPrice, total: unitPrice * i.quantity };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const discountTotal = Math.min(dto.discountTotal ?? 0, subtotal);
    const shippingFee = dto.shippingFee ?? 0;
    const total = subtotal - discountTotal + shippingFee;

    let result: { orderId: string; code: string; changes: StockChange[] };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const customerId = dto.customerId ?? (dto.customer ? await this.upsertCustomer(tx, tenantId, dto.customer) : null);
        const code = await nextOrderCode(tx, tenantId);
        const order = await tx.order.create({
          data: {
            tenantId,
            code,
            channelId: channel.id,
            channelType: channel.type,
            externalOrderId: source.externalOrderId,
            locationId,
            customerId,
            subtotal,
            discountTotal,
            shippingFee,
            total,
            note: dto.note?.trim() || null,
            shippingAddress: dto.shippingAddress ? { ...dto.shippingAddress } : undefined,
            paymentStatus: dto.paid ? "PAID" : "UNPAID",
            createdById: actorId,
            assignedToId: dto.assignedToId,
            stockReservedAt: new Date(),
            items: { create: lines },
          },
        });
        if (dto.paid) {
          await tx.payment.create({ data: { orderId: order.id, method: channel.type === "WEBSITE" || channel.type === "FACEBOOK" ? "BANK_TRANSFER" : "EWALLET", amount: total } });
        }
        const changes: StockChange[] = [];
        for (const l of lines) {
          const level = await this.inventory.applyMovement(tx, {
            tenantId,
            variantId: l.variantId,
            locationId,
            delta: 0,
            reservedDelta: l.quantity,
            type: "RESERVE",
            note: `Giữ hàng cho đơn ${code}`,
            actorId,
            referenceType: "Order",
            referenceId: order.id,
          });
          changes.push({ variantId: l.variantId, level: toLevel(level), type: "RESERVE", delta: l.quantity });
        }
        await tx.activityLog.create({
          data: { tenantId, actorId, action: "order.created", entityType: "Order", entityId: order.id, metadata: { code, channel: channel.type, total, source: source.kind } },
        });
        return { orderId: order.id, code, changes };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("Đơn này đã được nhập trước đó");
      throw e;
    }

    await this.inventory.afterCommit(tenantId, result.changes, actorId);
    this.emit(tenantId, "created", result.orderId);
    if (source.kind === "marketplace") {
      await this.notifications.notify(tenantId, "order:read_all", {
        type: "order.new",
        title: `Đơn mới ${result.code} từ ${channel.name}`,
        body: `${lines.length} sản phẩm, ${new Intl.NumberFormat("vi-VN").format(total)}₫. Cần xác nhận.`,
        href: `/app/orders/${result.orderId}`,
      });
    }
    return result;
  }

  private async upsertCustomer(tx: Tx, tenantId: string, c: { fullName: string; phone?: string }) {
    if (!c.phone) return (await tx.customer.create({ data: { tenantId, fullName: c.fullName } })).id;
    const existing = await tx.customer.findUnique({ where: { tenantId_phone: { tenantId, phone: c.phone } } });
    return existing?.id ?? (await tx.customer.create({ data: { tenantId, fullName: c.fullName, phone: c.phone } })).id;
  }

  // -------------------------------------------------------------------------
  // Status & assignment
  // -------------------------------------------------------------------------

  async updateStatus(user: AuthUser, id: string, dto: UpdateStatusDto): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { AND: [this.scope(user), { id }] }, include: { items: true } });
    if (!order) throw new NotFoundException("Không tìm thấy đơn hàng");
    const to = dto.status;
    if (!ORDER_TRANSITIONS[order.status].includes(to)) {
      throw new BadRequestException(`Không thể chuyển đơn từ "${order.status}" sang "${to}"`);
    }
    if (!can(user.role, TRANSITION_PERMISSION[to])) throw new ForbiddenException("Vai trò của bạn không được thực hiện thao tác này với đơn hàng");
    if (to === "CANCELLED" && !dto.reason) throw new BadRequestException("Vui lòng nhập lý do huỷ đơn");
    if (to === "RETURNED" && !dto.reason) throw new BadRequestException("Vui lòng nhập lý do trả hàng");

    const locationId = order.locationId;
    const changes: StockChange[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Optimistic guard: two people acting on the same order — only the first wins.
      const { count } = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: to } });
      if (count === 0) throw new ConflictException("Đơn hàng vừa được người khác cập nhật. Tải lại để xem trạng thái mới.");

      const move = async (type: InventoryMovementType, delta: number, reservedDelta: number, note: string) => {
        if (!locationId) return;
        for (const item of order.items) {
          if (!item.variantId) continue;
          const level = await this.inventory.applyMovement(tx, {
            tenantId: user.tenantId,
            variantId: item.variantId,
            locationId,
            delta: delta * item.quantity,
            reservedDelta: reservedDelta * item.quantity,
            type,
            note,
            actorId: user.userId,
            referenceType: "Order",
            referenceId: order.id,
          });
          changes.push({ variantId: item.variantId, level: toLevel(level), type, delta: (type === "RELEASE" ? reservedDelta : delta) * item.quantity });
        }
      };

      const data: Prisma.OrderUpdateInput = {};
      // Goods leave the shelf when the order ships (or is completed without a shipping step).
      if ((to === "SHIPPING" || to === "COMPLETED") && PRE_SHIP.includes(order.status) && !order.stockDeductedAt) {
        await move("SALE", -1, order.stockReservedAt ? -1 : 0, `Xuất kho cho đơn ${order.code}`);
        data.stockDeductedAt = new Date();
        data.fulfillmentStatus = "FULFILLED";
      }
      if (to === "CANCELLED") {
        if (order.stockReservedAt && !order.stockDeductedAt) await move("RELEASE", 0, -1, `Huỷ đơn ${order.code}`);
        data.cancelledAt = new Date();
        data.cancelReason = dto.reason;
      }
      if (to === "RETURNED") {
        // Only put units back if they actually left the shelf (SALE on ship/complete, or POS checkout).
        // Orders without the mark (e.g. imported or seeded history) never touched stock, so a return
        // must not add any. RETURNED is terminal, so this runs at most once per order.
        if (order.stockDeductedAt) await move("RETURN", 1, 0, `Khách trả đơn ${order.code}`);
        if (order.paymentStatus === "PAID") data.paymentStatus = "REFUNDED";
        // cancelReason holds the reason for both outcomes; the status tells which one it is.
        data.cancelReason = dto.reason;
        // Take back what the customer was credited for this order. Credit happens only on
        // reaching COMPLETED (status change, or POS checkout which also adds points), so a
        // return from SHIPPING has nothing to undo. RETURNED is terminal: this runs once.
        if (order.status === "COMPLETED" && order.customerId) {
          const points = order.externalOrderId?.startsWith(POS_CHECKOUT_REF_PREFIX) ? loyaltyPointsFor(num(order.total)) : 0;
          await tx.$executeRaw`
            UPDATE "Customer"
            SET "orderCount" = GREATEST("orderCount" - 1, 0),
                "totalSpent" = GREATEST("totalSpent" - ${order.total}, 0),
                "loyaltyPoints" = GREATEST("loyaltyPoints" - ${points}, 0),
                "updatedAt" = NOW()
            WHERE id = ${order.customerId}`;
        }
      }
      if (to === "COMPLETED") {
        data.completedAt = new Date();
        if (order.paymentStatus !== "PAID") {
          // Cash on delivery is collected when the order completes.
          await tx.payment.create({ data: { orderId: id, method: order.channelType === "POS" ? "CASH" : "COD", amount: order.total } });
          data.paymentStatus = "PAID";
        }
        if (order.customerId) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { orderCount: { increment: 1 }, totalSpent: { increment: order.total }, lastOrderAt: new Date() },
          });
        }
      }
      if (Object.keys(data).length) await tx.order.update({ where: { id }, data });
      await tx.activityLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.userId,
          action: "order.status_changed",
          entityType: "Order",
          entityId: id,
          metadata: { from: order.status, to, ...(dto.reason && { reason: dto.reason }) },
        },
      });
    });

    if (changes.length) await this.inventory.afterCommit(user.tenantId, changes, user.userId);
    this.emit(user.tenantId, "updated", id);
    return this.get(user, id);
  }

  async assign(user: AuthUser, id: string, assigneeId: string | null | undefined): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { id, tenantId: user.tenantId, ...locationWhere(user) }, select: { id: true, assignedToId: true } });
    if (!order) throw new NotFoundException("Không tìm thấy đơn hàng");
    let name: string | null = null;
    if (assigneeId) {
      const m = await this.prisma.membership.findFirst({ where: { userId: assigneeId, tenantId: user.tenantId, status: "ACTIVE" }, include: { user: { select: { fullName: true } } } });
      if (!m) throw new NotFoundException("Nhân viên không thuộc cửa hàng");
      name = m.user.fullName;
    }
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id }, data: { assignedToId: assigneeId ?? null } }),
      this.prisma.activityLog.create({
        data: { tenantId: user.tenantId, actorId: user.userId, action: "order.assigned", entityType: "Order", entityId: id, metadata: { to: name } },
      }),
    ]);
    this.emit(user.tenantId, "updated", id);
    return this.get(user, id);
  }

  private async emit(tenantId: string, kind: OrderEvent["kind"], orderId: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, code: true, channelType: true, status: true, total: true, assignedToId: true, locationId: true } });
    if (!o) return;
    const event: OrderEvent = { orderId: o.id, code: o.code, channelType: o.channelType as ChannelType, status: o.status, total: num(o.total), assignedToId: o.assignedToId, locationId: o.locationId, kind };
    this.realtime.emitToTenant(tenantId, kind === "created" ? "order.created" : "order.updated", event);
  }
}
