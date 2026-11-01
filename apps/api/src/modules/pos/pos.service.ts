import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { can, type OrderEvent, type PosPaymentMethod, type PosProduct, type PosReceipt, type PosShift, type ShiftCloseReport, type StockLevel } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { inScope, locationWhere } from "../../common/location-scope";
import type { AuthUser } from "../../common/permissions.guard";
import { formatVnd } from "../../common/format";
import { PrismaService } from "../../prisma/prisma.module";
import { InventoryService, toLevel } from "../inventory/inventory.service";
import { NotificationsService } from "../notifications/notifications.module";
import { nextOrderCode } from "../orders/order-code";
import { RealtimeGateway } from "../realtime/realtime.module";
import type { CheckoutDto, CloseShiftDto, OpenShiftDto, PosProductQuery } from "./pos.dto";

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));
/** One loyalty point per 10.000₫ spent. */
const POINTS_PER_VND = 10_000;

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Shifts
  // -------------------------------------------------------------------------

  async current(user: AuthUser): Promise<PosShift | null> {
    const s = await this.prisma.posSession.findFirst({
      where: { tenantId: user.tenantId, openedById: user.userId, closedAt: null },
      include: { location: { select: { id: true, name: true } } },
    });
    return s ? this.shiftInfo(s) : null;
  }

  /** Staff may only open a shift at the locations they are assigned to (none assigned = any). */
  async open(user: AuthUser, dto: OpenShiftDto): Promise<PosShift> {
    if (!inScope(user, dto.locationId)) throw new ForbiddenException("Bạn chỉ được mở ca tại chi nhánh được phân công");
    const location = await this.prisma.location.findFirst({ where: { id: dto.locationId, tenantId: user.tenantId, isActive: true } });
    if (!location) throw new NotFoundException("Không tìm thấy chi nhánh");
    if (location.type !== "STORE") throw new BadRequestException("Chỉ mở ca bán hàng tại cửa hàng, không mở tại kho");
    if (await this.current(user)) throw new ConflictException("Bạn đang có một ca chưa đóng");

    const s = await this.prisma.posSession.create({
      data: { tenantId: user.tenantId, locationId: location.id, openedById: user.userId, openingCash: dto.openingCash },
      include: { location: { select: { id: true, name: true } } },
    });
    await this.prisma.activityLog.create({
      data: { tenantId: user.tenantId, actorId: user.userId, action: "pos.shift_opened", entityType: "PosSession", entityId: s.id, metadata: { location: location.name, openingCash: dto.openingCash } },
    });
    return this.shiftInfo(s);
  }

  async close(user: AuthUser, id: string, dto: CloseShiftDto): Promise<ShiftCloseReport> {
    const s = await this.prisma.posSession.findFirst({ where: { id, tenantId: user.tenantId }, include: { location: { select: { id: true, name: true } } } });
    if (!s) throw new NotFoundException("Không tìm thấy ca bán hàng");
    // The cashier closes their own shift; managers can close any (e.g. someone forgot).
    if (s.openedById !== user.userId && !can(user.role, "order:read_all")) throw new ForbiddenException("Bạn chỉ được đóng ca của mình");
    if (s.closedAt) throw new ConflictException("Ca này đã được đóng");

    const info = await this.shiftInfo(s);
    const closedAt = new Date();
    const { count } = await this.prisma.posSession.updateMany({ where: { id, closedAt: null }, data: { closedAt, closingCash: dto.countedCash } });
    if (!count) throw new ConflictException("Ca này vừa được đóng");
    const difference = dto.countedCash - info.expectedCash;
    if (difference !== 0) {
      const cashier = await this.prisma.user.findUnique({ where: { id: s.openedById }, select: { fullName: true } });
      await this.notifications.notify(user.tenantId, "order:read_all", {
        type: "shift.discrepancy",
        title: `Ca ${s.location.name} ${difference < 0 ? "thiếu" : "thừa"} ${formatVnd(Math.abs(difference))}`,
        body: `${cashier?.fullName ?? "Thu ngân"} đóng ca: phải có ${formatVnd(info.expectedCash)}, đếm được ${formatVnd(dto.countedCash)}.${dto.note ? ` Ghi chú: ${dto.note}` : ""}`,
        href: "/app/activity",
      });
    }
    await this.prisma.activityLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.userId,
        action: "pos.shift_closed",
        entityType: "PosSession",
        entityId: id,
        metadata: { expected: info.expectedCash, counted: dto.countedCash, difference, note: dto.note ?? null },
      },
    });
    return {
      id,
      location: s.location.name,
      openedAt: s.openedAt.toISOString(),
      closedAt: closedAt.toISOString(),
      orders: info.orders,
      revenue: info.revenue,
      byMethod: info.byMethod,
      openingCash: info.openingCash,
      expectedCash: info.expectedCash,
      countedCash: dto.countedCash,
      difference,
    };
  }

  private async shiftInfo(s: { id: string; openedAt: Date; openingCash: Prisma.Decimal; location: { id: string; name: string } }): Promise<PosShift> {
    const [orders, payments] = await Promise.all([
      this.prisma.order.aggregate({ where: { posSessionId: s.id, status: "COMPLETED" }, _count: true, _sum: { total: true } }),
      this.prisma.payment.groupBy({ by: ["method"], where: { order: { posSessionId: s.id, status: "COMPLETED" } }, _sum: { amount: true } }),
    ]);
    const byMethod: PosShift["byMethod"] = {};
    for (const p of payments) byMethod[p.method as PosPaymentMethod] = num(p._sum.amount);
    return {
      id: s.id,
      location: s.location,
      openedAt: s.openedAt.toISOString(),
      openingCash: num(s.openingCash),
      orders: orders._count,
      revenue: num(orders._sum.total),
      byMethod,
      expectedCash: num(s.openingCash) + (byMethod.CASH ?? 0),
    };
  }

  private async requireOpenShift(user: AuthUser, sessionId: string) {
    const s = await this.prisma.posSession.findFirst({ where: { id: sessionId, tenantId: user.tenantId }, include: { location: { select: { id: true, name: true } } } });
    if (!s) throw new NotFoundException("Không tìm thấy ca bán hàng");
    if (s.openedById !== user.userId) throw new ForbiddenException("Ca này không phải của bạn");
    if (s.closedAt) throw new ConflictException("Ca đã đóng. Mở ca mới để bán tiếp.");
    // The assignment may have been narrowed after the shift was opened.
    if (!inScope(user, s.locationId)) throw new ForbiddenException("Bạn chỉ được bán tại chi nhánh được phân công");
    return s;
  }

  // -------------------------------------------------------------------------
  // Catalogue for the counter
  // -------------------------------------------------------------------------

  /** Sellable variants with stock at the shift's store. An exact barcode/SKU match comes first (scanner input). */
  async products(user: AuthUser, q: PosProductQuery): Promise<PosProduct[]> {
    const s = await this.requireOpenShift(user, q.sessionId);
    const search = q.q?.trim();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        product: { status: "ACTIVE", deletedAt: null, ...(q.categoryId && { categoryId: q.categoryId }) },
        ...(search && {
          OR: [
            { barcode: search },
            { sku: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        }),
      },
      include: {
        product: { select: { id: true, name: true, category: { select: { name: true } } } },
        inventory: { where: { locationId: s.locationId } },
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: 80,
    });
    const items = variants.map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      variantName: v.name,
      sku: v.sku,
      barcode: v.barcode,
      category: v.product.category?.name ?? null,
      price: Number(v.price),
      available: Math.max(0, (v.inventory[0]?.onHand ?? 0) - (v.inventory[0]?.reserved ?? 0)),
    }));
    const exact = (p: PosProduct) => (search && (p.barcode === search || p.sku.toLowerCase() === search.toLowerCase()) ? 0 : 1);
    return items.sort((a, b) => exact(a) - exact(b));
  }

  // -------------------------------------------------------------------------
  // Checkout
  // -------------------------------------------------------------------------

  /**
   * Rings up a sale: a COMPLETED POS order, stock deducted at the store right
   * away, payment recorded, loyalty points added. Idempotent per clientRef so
   * a double tap or a retried request never charges twice.
   */
  async checkout(user: AuthUser, dto: CheckoutDto): Promise<PosReceipt> {
    const session = await this.requireOpenShift(user, dto.sessionId);
    const channel = await this.prisma.channel.findFirst({ where: { tenantId: user.tenantId, type: "POS" } });
    if (!channel) throw new BadRequestException("Cửa hàng chưa bật kênh bán tại quầy");
    const ref = `pos:${dto.clientRef}`;

    const existing = await this.prisma.order.findUnique({ where: { channelId_externalOrderId: { channelId: channel.id, externalOrderId: ref } } });
    if (existing) return this.receipt(user, existing.id);

    if ((dto.discount ?? 0) > 0 && !can(user.role, "pos:discount")) throw new ForbiddenException("Giảm giá cần quyền Quản lý");
    if (dto.customerId && !(await this.prisma.customer.count({ where: { id: dto.customerId, tenantId: user.tenantId } }))) throw new NotFoundException("Không tìm thấy khách hàng");

    const qty = new Map<string, number>();
    for (const i of dto.items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...qty.keys()] }, tenantId: user.tenantId, isActive: true, product: { status: "ACTIVE", deletedAt: null } },
      include: { product: { select: { name: true } }, inventory: { where: { locationId: session.locationId } } },
    });
    if (variants.length !== qty.size) throw new BadRequestException("Có sản phẩm trong giỏ không còn bán");

    // Friendly per-line stock check before touching the ledger (the ledger re-checks under lock).
    for (const v of variants) {
      const available = (v.inventory[0]?.onHand ?? 0) - (v.inventory[0]?.reserved ?? 0);
      if (qty.get(v.id)! > available) throw new BadRequestException(`${v.product.name}, ${v.name} chỉ còn ${Math.max(0, available)} tại ${session.location.name}`);
    }

    const lines = variants.map((v) => {
      const q = qty.get(v.id)!;
      return { variantId: v.id, sku: v.sku, name: `${v.product.name}, ${v.name}`, quantity: q, unitPrice: Number(v.price), total: Number(v.price) * q };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const discount = Math.min(dto.discount ?? 0, subtotal);
    const total = subtotal - discount;
    if (dto.method === "CASH" && (dto.received ?? total) < total) throw new BadRequestException(`Khách đưa chưa đủ: cần ${formatVnd(total)}`);

    let orderId: string;
    const changes: { variantId: string; level: StockLevel; type: "SALE"; delta: number }[] = [];
    try {
      orderId = await this.prisma.$transaction(async (tx) => {
        let customerId = dto.customerId ?? null;
        if (!customerId && dto.customer) {
          const found = await tx.customer.findUnique({ where: { tenantId_phone: { tenantId: user.tenantId, phone: dto.customer.phone } } });
          customerId = found?.id ?? (await tx.customer.create({ data: { tenantId: user.tenantId, fullName: dto.customer.fullName, phone: dto.customer.phone } })).id;
        }
        const code = await nextOrderCode(tx, user.tenantId);
        const now = new Date();
        const order = await tx.order.create({
          data: {
            tenantId: user.tenantId,
            code,
            channelId: channel.id,
            channelType: "POS",
            externalOrderId: ref,
            locationId: session.locationId,
            customerId,
            status: "COMPLETED",
            paymentStatus: "PAID",
            fulfillmentStatus: "FULFILLED",
            subtotal,
            discountTotal: discount,
            total,
            createdById: user.userId,
            posSessionId: session.id,
            stockDeductedAt: now,
            completedAt: now,
            items: { create: lines },
            payments: {
              create: { method: dto.method, amount: total, reference: dto.method === "CASH" && dto.received ? `Khách đưa ${formatVnd(dto.received)}` : null },
            },
          },
        });
        for (const l of lines) {
          const level = await this.inventory.applyMovement(tx, {
            tenantId: user.tenantId,
            variantId: l.variantId,
            locationId: session.locationId,
            delta: -l.quantity,
            type: "SALE",
            note: `Bán tại quầy ${code}`,
            actorId: user.userId,
            referenceType: "Order",
            referenceId: order.id,
          });
          changes.push({ variantId: l.variantId, level: toLevel(level), type: "SALE", delta: -l.quantity });
        }
        if (customerId) {
          await tx.customer.update({
            where: { id: customerId },
            data: { orderCount: { increment: 1 }, totalSpent: { increment: total }, lastOrderAt: now, loyaltyPoints: { increment: Math.floor(total / POINTS_PER_VND) } },
          });
        }
        await tx.activityLog.create({
          data: { tenantId: user.tenantId, actorId: user.userId, action: "order.created", entityType: "Order", entityId: order.id, metadata: { code, channel: "POS", total, source: "pos" } },
        });
        return order.id;
      });
    } catch (e) {
      // Two taps raced past the idempotency check: return the order the first one created.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const o = await this.prisma.order.findUnique({ where: { channelId_externalOrderId: { channelId: channel.id, externalOrderId: ref } } });
        if (o) return this.receipt(user, o.id);
      }
      throw e;
    }

    await this.inventory.afterCommit(user.tenantId, changes, user.userId);
    const receipt = await this.receipt(user, orderId, dto.received);
    const event: OrderEvent = { orderId, code: receipt.code, channelType: "POS", status: "COMPLETED", total, assignedToId: null, locationId: session.locationId, kind: "created" };
    this.realtime.emitToTenant(user.tenantId, "order.created", event);
    return receipt;
  }

  async receipt(user: AuthUser, orderId: string, received?: number): Promise<PosReceipt> {
    const o = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId, channelType: "POS", ...locationWhere(user) },
      include: { items: true, payments: true, customer: true, location: true, createdBy: { select: { fullName: true } }, tenant: { select: { name: true } } },
    });
    if (!o) throw new NotFoundException("Không tìm thấy hoá đơn");
    const total = num(o.total);
    const method = (o.payments[0]?.method ?? "CASH") as PosPaymentMethod;
    const cash = method === "CASH" ? (received ?? Number(o.payments[0]?.reference?.replace(/\D/g, "") || total)) : null;
    return {
      orderId: o.id,
      code: o.code,
      at: o.placedAt.toISOString(),
      shopName: o.tenant.name,
      locationName: o.location?.name ?? "",
      cashierName: o.createdBy?.fullName ?? "",
      customer: o.customer
        ? { fullName: o.customer.fullName, phone: o.customer.phone, pointsEarned: Math.floor(total / POINTS_PER_VND), pointsTotal: o.customer.loyaltyPoints }
        : null,
      items: o.items.map((i) => ({ name: i.name, sku: i.sku, quantity: i.quantity, unitPrice: num(i.unitPrice), total: num(i.total) })),
      subtotal: num(o.subtotal),
      discount: num(o.discountTotal),
      total,
      method,
      received: cash,
      change: cash !== null ? cash - total : null,
    };
  }
}
