import { BadRequestException, Injectable } from "@nestjs/common";
import { IN_PROGRESS_STATUSES, REVENUE_STATUS, type ChannelType, type ReportGroupBy, type SalesReport } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { locationSql } from "../../common/location-scope";
import type { AuthUser } from "../../common/permissions.guard";
import { startOfVnDay, vnDateKey } from "../../common/time";
import { PrismaService } from "../../prisma/prisma.module";

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;
/** "2026-10-01" (Vietnam calendar day) → UTC instant of its 00:00 local. */
const vnDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - VN_OFFSET);
};
const isDateKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Money stays Decimal through the sums below; num() converts once, when the response is built.
type Money = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);
const num = (d: Money | null | undefined) => (d == null ? 0 : Number(d));
const sum = (xs: Money[]) => xs.reduce((s, x) => s.add(x), ZERO);

/** Orders that count as sales: COMPLETED only (see REVENUE_STATUS). In-progress orders are reported apart. */
const VALID = Prisma.sql`o.status = ${REVENUE_STATUS}::"OrderStatus"`;
const IN_PROGRESS = new Set<string>(IN_PROGRESS_STATUSES);
/** placedAt in Vietnam local time (stored as UTC without zone). */
const LOCAL = Prisma.sql`(o."placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'`;
/**
 * Cost of a line: the cost price snapshotted when it was sold. Lines older than
 * the snapshot column fall back to today's cost price (flagged as estimated).
 */
const LINE_COST = Prisma.sql`oi.quantity * COALESCE(oi."unitCost", v."costPrice", 0)`;

@Injectable()
export class SalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(user: AuthUser, q: { from?: string; to?: string; groupBy?: ReportGroupBy; locationId?: string }): Promise<SalesReport> {
    const toKey = isDateKey(q.to) ? q.to! : vnDateKey(new Date());
    const fromKey = isDateKey(q.from) ? q.from! : vnDateKey(new Date(startOfVnDay(new Date(), -29).getTime() + VN_OFFSET));
    const from = vnDay(fromKey);
    const to = new Date(vnDay(toKey).getTime() + DAY); // exclusive end
    if (to <= from) throw new BadRequestException("Ngày bắt đầu phải trước ngày kết thúc");
    const spanDays = Math.round((to.getTime() - from.getTime()) / DAY);
    if (spanDays > 400) throw new BadRequestException("Khoảng thời gian tối đa 400 ngày");
    const groupBy: ReportGroupBy = q.groupBy ?? (spanDays <= 31 ? "day" : spanDays <= 120 ? "week" : "month");
    const prevFrom = new Date(from.getTime() - spanDays * DAY);

    const t = user.tenantId;
    // Only unrestricted roles reach this route today, but keep it branch-safe anyway.
    const loc = locationSql(user, Prisma.sql`o."locationId"`, q.locationId);
    const range = (a: Date, b: Date) => Prisma.sql`o."tenantId" = ${t} AND o."placedAt" >= ${a} AND o."placedAt" < ${b} ${loc}`;
    const unit = Prisma.raw(`'${groupBy}'`); // whitelisted above

    const [totals, prevTotals, cogs, prevCogs, series, locations, products, categories, staff, heat, newCustomers] = await Promise.all([
      this.prisma.$queryRaw<{ status: string; n: number; revenue: Money }[]>`
        SELECT o.status, COUNT(*)::int AS n, COALESCE(SUM(o.total), 0) AS revenue FROM "Order" o WHERE ${range(from, to)} GROUP BY o.status`,
      this.prisma.$queryRaw<{ n: number; revenue: Money }[]>`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(o.total), 0) AS revenue FROM "Order" o WHERE ${range(prevFrom, from)} AND ${VALID}`,
      this.cogs(range(from, to)),
      this.cogs(range(prevFrom, from)),
      this.prisma.$queryRaw<{ period: Date; channel: ChannelType; revenue: Money; n: number }[]>`
        SELECT date_trunc(${unit}, ${LOCAL}) AS period, o."channelType" AS channel, SUM(o.total) AS revenue, COUNT(*)::int AS n
        FROM "Order" o WHERE ${range(from, to)} AND ${VALID} GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; name: string; n: number; revenue: Money }[]>`
        SELECT l.id, l.name, COUNT(*)::int AS n, SUM(o.total) AS revenue
        FROM "Order" o JOIN "Location" l ON l.id = o."locationId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY l.id, l.name ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ name: string; sku: string; quantity: number; revenue: Money; cost: Money; estimated: boolean }[]>`
        SELECT oi.name, oi.sku, SUM(oi.quantity)::int AS quantity, SUM(oi.total) AS revenue,
               SUM(${LINE_COST}) AS cost, bool_or(oi."unitCost" IS NULL) AS estimated
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" LEFT JOIN "ProductVariant" v ON v.id = oi."variantId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY oi.name, oi.sku ORDER BY revenue DESC LIMIT 20`,
      this.prisma.$queryRaw<{ name: string; quantity: number; revenue: Money }[]>`
        SELECT COALESCE(c.name, 'Chưa phân loại') AS name, SUM(oi.quantity)::int AS quantity, SUM(oi.total) AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        LEFT JOIN "ProductVariant" v ON v.id = oi."variantId" LEFT JOIN "Product" p ON p.id = v."productId" LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY 1 ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ id: string; name: string; avatar: string | null; pos_n: number; pos_rev: Money; handled: number }[]>`
        SELECT u.id, u."fullName" AS name, u."avatarUrl" AS avatar,
               COUNT(*) FILTER (WHERE o."channelType" = 'POS' AND o."createdById" = u.id)::int AS pos_n,
               COALESCE(SUM(o.total) FILTER (WHERE o."channelType" = 'POS' AND o."createdById" = u.id), 0) AS pos_rev,
               COUNT(*) FILTER (WHERE o."assignedToId" = u.id)::int AS handled
        FROM "Order" o JOIN "User" u ON u.id = o."createdById" OR u.id = o."assignedToId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY u.id ORDER BY pos_rev DESC, handled DESC`,
      this.prisma.$queryRaw<{ dow: number; hour: number; n: number }[]>`
        SELECT EXTRACT(ISODOW FROM ${LOCAL})::int AS dow, EXTRACT(HOUR FROM ${LOCAL})::int AS hour, COUNT(*)::int AS n
        FROM "Order" o WHERE ${range(from, to)} AND ${VALID} GROUP BY 1, 2`,
      this.prisma.customer.count({ where: { tenantId: t, createdAt: { gte: from, lt: to } } }),
    ]);

    const completed = totals.filter((r) => r.status === REVENUE_STATUS);
    const revenue = sum(completed.map((r) => r.revenue));
    const orders = completed.reduce((s, r) => s + r.n, 0);
    const inProgress = totals.filter((r) => IN_PROGRESS.has(r.status));
    const cancelled = totals.find((r) => r.status === "CANCELLED")?.n ?? 0;
    const returned = totals.find((r) => r.status === "RETURNED")?.n ?? 0;
    const grossProfit = revenue.sub(cogs.cost);
    const prevRevenue = prevTotals[0]?.revenue ?? ZERO;
    const prevOrders = prevTotals[0]?.n ?? 0;
    const ratio = (a: Money, b: Money) => (b.isZero() ? 0 : num(a.div(b)));

    // Fill empty periods so charts have a continuous axis.
    const periods = new Map<string, { revenue: Money; orders: number; byChannel: Partial<Record<ChannelType, Money>> }>();
    for (const key of this.periodKeys(from, to, groupBy)) periods.set(key, { revenue: ZERO, orders: 0, byChannel: {} });
    const channelTotals = new Map<ChannelType, { orders: number; revenue: Money }>();
    for (const r of series) {
      const p = periods.get(r.period.toISOString().slice(0, 10));
      if (p) {
        p.revenue = p.revenue.add(r.revenue);
        p.orders += r.n;
        p.byChannel[r.channel] = (p.byChannel[r.channel] ?? ZERO).add(r.revenue);
      }
      const c = channelTotals.get(r.channel) ?? { orders: 0, revenue: ZERO };
      c.orders += r.n;
      c.revenue = c.revenue.add(r.revenue);
      channelTotals.set(r.channel, c);
    }

    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const h of heat) heatmap[h.dow - 1][h.hour] = h.n;

    return {
      from: fromKey,
      to: toKey,
      groupBy,
      summary: {
        revenue: num(revenue),
        orders,
        aov: orders ? num(revenue.div(orders)) : 0,
        grossProfit: num(grossProfit),
        margin: ratio(grossProfit, revenue),
        itemsSold: cogs.items,
        cancelled,
        // Cancelled / (completed + cancelled); returned and in-progress orders stay out of the base.
        cancelRate: orders + cancelled ? cancelled / (orders + cancelled) : 0,
        returned,
        newCustomers,
        inProgressOrders: inProgress.reduce((s, r) => s + r.n, 0),
        inProgressTotal: num(sum(inProgress.map((r) => r.revenue))),
        costEstimatedItems: cogs.estimatedItems,
      },
      previous: {
        revenue: num(prevRevenue),
        orders: prevOrders,
        grossProfit: num(prevRevenue.sub(prevCogs.cost)),
        aov: prevOrders ? num(prevRevenue.div(prevOrders)) : 0,
      },
      series: [...periods.entries()].map(([period, p]) => ({
        period,
        revenue: num(p.revenue),
        orders: p.orders,
        byChannel: Object.fromEntries(Object.entries(p.byChannel).map(([ch, v]) => [ch, num(v)])),
      })),
      channels: [...channelTotals.entries()]
        .map(([channel, v]) => ({ channel, orders: v.orders, revenue: num(v.revenue), share: ratio(v.revenue, revenue) }))
        .sort((a, b) => b.revenue - a.revenue),
      locations: locations.map((l) => ({ locationId: l.id, name: l.name, orders: l.n, revenue: num(l.revenue) })),
      products: products.map((p) => ({ name: p.name, sku: p.sku, quantity: p.quantity, revenue: num(p.revenue), profit: num(p.revenue.sub(p.cost)), profitEstimated: p.estimated })),
      categories: categories.map((c) => ({ name: c.name, quantity: c.quantity, revenue: num(c.revenue) })),
      staff: staff.map((s) => ({ userId: s.id, fullName: s.name, avatarUrl: s.avatar, posOrders: s.pos_n, posRevenue: num(s.pos_rev), handledOrders: s.handled })),
      heatmap,
    };
  }

  /** Units sold and their cost; `estimatedItems` = units with no cost snapshot (priced at today's cost). */
  private async cogs(where: Prisma.Sql): Promise<{ items: number; cost: Money; estimatedItems: number }> {
    const [r] = await this.prisma.$queryRaw<{ items: number; cost: Money; estimated_items: number }[]>`
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS items,
             COALESCE(SUM(${LINE_COST}), 0) AS cost,
             COALESCE(SUM(oi.quantity) FILTER (WHERE oi."unitCost" IS NULL), 0)::int AS estimated_items
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" LEFT JOIN "ProductVariant" v ON v.id = oi."variantId"
      WHERE ${where} AND ${VALID}`;
    return r ? { items: r.items, cost: r.cost, estimatedItems: r.estimated_items } : { items: 0, cost: ZERO, estimatedItems: 0 };
  }

  /** Period keys matching Postgres date_trunc on local dates (weeks start Monday). */
  private periodKeys(from: Date, to: Date, groupBy: ReportGroupBy): string[] {
    const keys: string[] = [];
    const local = (d: Date) => new Date(d.getTime() + VN_OFFSET); // read UTC fields as local
    let cur = local(from);
    if (groupBy === "week") cur = new Date(cur.getTime() - ((cur.getUTCDay() + 6) % 7) * DAY);
    if (groupBy === "month") cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
    const end = local(to);
    while (cur < end) {
      keys.push(cur.toISOString().slice(0, 10));
      cur = groupBy === "month" ? new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)) : new Date(cur.getTime() + (groupBy === "week" ? 7 : 1) * DAY);
    }
    return keys;
  }
}
