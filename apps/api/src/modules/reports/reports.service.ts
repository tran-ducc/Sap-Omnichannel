import { Injectable } from "@nestjs/common";
import { can, type ChannelType, type DashboardOverview, type DashboardRange } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { locationWhere } from "../../common/location-scope";
import type { AuthUser } from "../../common/permissions.guard";
import { startOfVnDay, startOfVnMonth, vnDateKey } from "../../common/time";
import { PrismaService } from "../../prisma/prisma.module";

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));

interface DayStats {
  revenue: number;
  orders: number;
  cancelled: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard overview. Admin/Manager get the whole shop; Staff
   * (no "report:detailed") get the same KPIs computed only over orders they
   * created or were assigned, and no shop-wide breakdowns.
   */
  async overview(user: AuthUser, range: DashboardRange = "today"): Promise<DashboardOverview> {
    const detailed = can(user.role, "report:detailed");
    const now = new Date();
    const weekStart = startOfVnDay(now, -6);

    // Current period ends now; the comparison period has the same length and ends where the current one starts.
    const from = range === "today" ? startOfVnDay(now) : startOfVnDay(now, range === "7d" ? -6 : -29);
    const prevFrom = new Date(from.getTime() - (range === "today" ? 86_400_000 : now.getTime() - from.getTime()));
    const prevTo = range === "today" ? new Date(now.getTime() - 86_400_000) : from; // "today" compares with the same hours yesterday

    // Detailed sections below only run for unrestricted roles; the summary follows the staff branch scope.
    const scope: Prisma.OrderWhereInput = detailed
      ? { tenantId: user.tenantId, ...locationWhere(user) }
      : { tenantId: user.tenantId, OR: [{ createdById: user.userId }, { assignedToId: user.userId }], ...locationWhere(user) };

    const [cur, prev, recentOrders] = await Promise.all([
      this.periodStats(scope, from, now),
      this.periodStats(scope, prevFrom, prevTo),
      this.prisma.order.findMany({
        where: scope,
        orderBy: { placedAt: "desc" },
        take: 6,
        include: { customer: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
      }),
    ]);

    const result: DashboardOverview = {
      scope: detailed ? "full" : "summary",
      range,
      generatedAt: now.toISOString(),
      kpis: {
        revenue: { current: cur.revenue, previous: prev.revenue },
        orders: { current: cur.orders, previous: prev.orders },
        aov: { current: cur.orders ? cur.revenue / cur.orders : 0, previous: prev.orders ? prev.revenue / prev.orders : 0 },
        cancelRate: { current: rate(cur), previous: rate(prev) },
      },
      daily: [],
      channelShare: [],
      topProducts: [],
      lowStock: [],
      lowStockCount: 0,
      monthRevenue: 0,
      lastMonthRevenue: 0,
      topSeller: null,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        code: o.code,
        channelType: o.channelType,
        customerName: o.customer?.fullName ?? null,
        total: num(o.total),
        status: o.status,
        placedAt: o.placedAt.toISOString(),
        assignedToName: o.assignedTo?.fullName ?? null,
      })),
    };

    if (!detailed) return result;

    const [daily, topProducts, lowStock, month, topSeller] = await Promise.all([
      this.daily(user.tenantId, weekStart),
      this.topProducts(user.tenantId, weekStart),
      this.lowStock(user.tenantId),
      this.monthRevenue(user.tenantId, now),
      this.topSeller(user.tenantId, startOfVnMonth(now)),
    ]);

    result.daily = daily.map(({ ordersByChannel: _internal, ...d }) => d);
    const share = new Map<ChannelType, { orders: number; revenue: number }>();
    for (const d of daily) {
      for (const [ch, rev] of Object.entries(d.byChannel) as [ChannelType, number][]) {
        const s = share.get(ch) ?? { orders: 0, revenue: 0 };
        s.revenue += rev;
        share.set(ch, s);
      }
    }
    for (const row of d7Orders(daily)) {
      const s = share.get(row.channel);
      if (s) s.orders = row.orders;
    }
    result.channelShare = [...share.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.revenue - a.revenue);
    result.topProducts = topProducts;
    result.lowStock = lowStock.items;
    result.lowStockCount = lowStock.count;
    result.monthRevenue = month.current;
    result.lastMonthRevenue = month.previous;
    result.topSeller = topSeller;
    return result;
  }

  // -------------------------------------------------------------------------

  private async periodStats(scope: Prisma.OrderWhereInput, from: Date, to: Date): Promise<DayStats> {
    const range = { placedAt: { gte: from, lt: to } };
    const [valid, cancelled] = await Promise.all([
      this.prisma.order.aggregate({ where: { ...scope, ...range, status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { total: true }, _count: true }),
      this.prisma.order.count({ where: { ...scope, ...range, status: "CANCELLED" } }),
    ]);
    return { revenue: num(valid._sum.total), orders: valid._count, cancelled };
  }

  /** Revenue and orders per Vietnam calendar day and channel, oldest first, gaps filled with zero. */
  private async daily(tenantId: string, from: Date) {
    // "placedAt" is stored as UTC without zone; convert to Vietnam local time before truncating to day.
    const rows = await this.prisma.$queryRaw<{ day: Date; channel: ChannelType; revenue: number; orders: number }[]>`
      SELECT date_trunc('day', ("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
             "channelType" AS channel,
             SUM(total)::float AS revenue,
             COUNT(*)::int AS orders
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
        AND "placedAt" >= ${from}
        AND status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY 1, 2`;

    const days = new Map<string, DashboardOverview["daily"][number] & { ordersByChannel: Partial<Record<ChannelType, number>> }>();
    for (let i = 0; i < 7; i++) {
      // from is 00:00 VN; +7h lands safely inside the same VN day for the key
      const key = vnDateKey(new Date(from.getTime() + i * 86_400_000));
      days.set(key, { date: key, total: 0, orders: 0, byChannel: {}, ordersByChannel: {} });
    }
    for (const r of rows) {
      // day is a local-time timestamp returned as if UTC, so its ISO date is the VN date
      const d = days.get(r.day.toISOString().slice(0, 10));
      if (!d) continue;
      d.total += r.revenue;
      d.orders += r.orders;
      d.byChannel[r.channel] = (d.byChannel[r.channel] ?? 0) + r.revenue;
      d.ordersByChannel[r.channel] = (d.ordersByChannel[r.channel] ?? 0) + r.orders;
    }
    return [...days.values()];
  }

  private async topProducts(tenantId: string, from: Date) {
    const rows = await this.prisma.orderItem.groupBy({
      by: ["name"],
      where: { order: { tenantId, placedAt: { gte: from }, status: { notIn: ["CANCELLED", "RETURNED"] } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });
    return rows.map((r) => ({ name: r.name, quantity: r._sum.quantity ?? 0, revenue: num(r._sum.total) }));
  }

  private async lowStock(tenantId: string) {
    // Field-to-field comparison: on hand at or below this row's own reorder point.
    const where: Prisma.InventoryLevelWhereInput = {
      tenantId,
      onHand: { lte: this.prisma.inventoryLevel.fields.reorderPoint },
      variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } },
    };
    const [count, items] = await Promise.all([
      this.prisma.inventoryLevel.count({ where }),
      this.prisma.inventoryLevel.findMany({
        where,
        orderBy: { onHand: "asc" },
        take: 5,
        include: { variant: { select: { id: true, sku: true, name: true, product: { select: { name: true } } } }, location: { select: { name: true } } },
      }),
    ]);
    return {
      count,
      items: items.map((i) => ({
        variantId: i.variant.id,
        name: `${i.variant.product.name}, ${i.variant.name}`,
        sku: i.variant.sku,
        location: i.location.name,
        available: i.onHand - i.reserved,
        reorderPoint: i.reorderPoint,
      })),
    };
  }

  /** This month so far vs. the same number of days last month. */
  private async monthRevenue(tenantId: string, now: Date) {
    const monthStart = startOfVnMonth(now);
    const lastMonthStart = startOfVnMonth(now, -1);
    const elapsed = now.getTime() - monthStart.getTime();
    const sum = (from: Date, to: Date) =>
      this.prisma.order.aggregate({
        where: { tenantId, placedAt: { gte: from, lt: to }, status: { notIn: ["CANCELLED", "RETURNED"] } },
        _sum: { total: true },
      });
    const [cur, prev] = await Promise.all([sum(monthStart, now), sum(lastMonthStart, new Date(Math.min(lastMonthStart.getTime() + elapsed, monthStart.getTime())))]);
    return { current: num(cur._sum.total), previous: num(prev._sum.total) };
  }

  private async topSeller(tenantId: string, from: Date) {
    const rows = await this.prisma.order.groupBy({
      by: ["createdById"],
      where: { tenantId, placedAt: { gte: from }, createdById: { not: null }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      _count: { _all: true },
      orderBy: { _count: { createdById: "desc" } },
      take: 1,
    });
    if (!rows[0]?.createdById) return null;
    const u = await this.prisma.user.findUnique({ where: { id: rows[0].createdById }, select: { fullName: true, avatarUrl: true } });
    return u ? { name: u.fullName, avatarUrl: u.avatarUrl, orders: rows[0]._count._all } : null;
  }
}

function rate(s: DayStats) {
  const all = s.orders + s.cancelled;
  return all ? s.cancelled / all : 0;
}

/** Sums the per-channel order counts the daily query collected. */
function d7Orders(daily: { ordersByChannel?: Partial<Record<ChannelType, number>> }[]) {
  const totals = new Map<ChannelType, number>();
  for (const d of daily) for (const [ch, n] of Object.entries(d.ordersByChannel ?? {}) as [ChannelType, number][]) totals.set(ch, (totals.get(ch) ?? 0) + n);
  return [...totals.entries()].map(([channel, orders]) => ({ channel, orders }));
}
