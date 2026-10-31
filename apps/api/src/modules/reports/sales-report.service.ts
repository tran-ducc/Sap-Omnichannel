import { BadRequestException, Injectable } from "@nestjs/common";
import type { ChannelType, ReportGroupBy, SalesReport } from "@omni/shared";
import { Prisma } from "@prisma/client";
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

/** Orders that count as sales. */
const VALID = Prisma.sql`o.status NOT IN ('CANCELLED', 'RETURNED')`;
/** placedAt in Vietnam local time (stored as UTC without zone). */
const LOCAL = Prisma.sql`(o."placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'`;

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
    const loc = q.locationId ? Prisma.sql`AND o."locationId" = ${q.locationId}` : Prisma.empty;
    const range = (a: Date, b: Date) => Prisma.sql`o."tenantId" = ${t} AND o."placedAt" >= ${a} AND o."placedAt" < ${b} ${loc}`;
    const unit = Prisma.raw(`'${groupBy}'`); // whitelisted above

    const [totals, prevTotals, cogs, prevCogs, series, locations, products, categories, staff, heat, newCustomers] = await Promise.all([
      this.prisma.$queryRaw<{ status: string; n: number; revenue: number }[]>`
        SELECT o.status, COUNT(*)::int AS n, COALESCE(SUM(o.total), 0)::float AS revenue FROM "Order" o WHERE ${range(from, to)} GROUP BY o.status`,
      this.prisma.$queryRaw<{ n: number; revenue: number }[]>`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(o.total), 0)::float AS revenue FROM "Order" o WHERE ${range(prevFrom, from)} AND ${VALID}`,
      this.cogs(range(from, to)),
      this.cogs(range(prevFrom, from)),
      this.prisma.$queryRaw<{ period: Date; channel: ChannelType; revenue: number; n: number }[]>`
        SELECT date_trunc(${unit}, ${LOCAL}) AS period, o."channelType" AS channel, SUM(o.total)::float AS revenue, COUNT(*)::int AS n
        FROM "Order" o WHERE ${range(from, to)} AND ${VALID} GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; name: string; n: number; revenue: number }[]>`
        SELECT l.id, l.name, COUNT(*)::int AS n, SUM(o.total)::float AS revenue
        FROM "Order" o JOIN "Location" l ON l.id = o."locationId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY l.id, l.name ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ name: string; sku: string; quantity: number; revenue: number; cost: number }[]>`
        SELECT oi.name, oi.sku, SUM(oi.quantity)::int AS quantity, SUM(oi.total)::float AS revenue,
               SUM(oi.quantity * COALESCE(v."costPrice", 0))::float AS cost
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" LEFT JOIN "ProductVariant" v ON v.id = oi."variantId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY oi.name, oi.sku ORDER BY revenue DESC LIMIT 20`,
      this.prisma.$queryRaw<{ name: string; quantity: number; revenue: number }[]>`
        SELECT COALESCE(c.name, 'Chưa phân loại') AS name, SUM(oi.quantity)::int AS quantity, SUM(oi.total)::float AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        LEFT JOIN "ProductVariant" v ON v.id = oi."variantId" LEFT JOIN "Product" p ON p.id = v."productId" LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY 1 ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ id: string; name: string; avatar: string | null; pos_n: number; pos_rev: number; handled: number }[]>`
        SELECT u.id, u."fullName" AS name, u."avatarUrl" AS avatar,
               COUNT(*) FILTER (WHERE o."channelType" = 'POS' AND o."createdById" = u.id)::int AS pos_n,
               COALESCE(SUM(o.total) FILTER (WHERE o."channelType" = 'POS' AND o."createdById" = u.id), 0)::float AS pos_rev,
               COUNT(*) FILTER (WHERE o."assignedToId" = u.id)::int AS handled
        FROM "Order" o JOIN "User" u ON u.id = o."createdById" OR u.id = o."assignedToId"
        WHERE ${range(from, to)} AND ${VALID} GROUP BY u.id ORDER BY pos_rev DESC, handled DESC`,
      this.prisma.$queryRaw<{ dow: number; hour: number; n: number }[]>`
        SELECT EXTRACT(ISODOW FROM ${LOCAL})::int AS dow, EXTRACT(HOUR FROM ${LOCAL})::int AS hour, COUNT(*)::int AS n
        FROM "Order" o WHERE ${range(from, to)} AND ${VALID} GROUP BY 1, 2`,
      this.prisma.customer.count({ where: { tenantId: t, createdAt: { gte: from, lt: to } } }),
    ]);

    const valid = totals.filter((r) => r.status !== "CANCELLED" && r.status !== "RETURNED");
    const revenue = valid.reduce((s, r) => s + r.revenue, 0);
    const orders = valid.reduce((s, r) => s + r.n, 0);
    const cancelled = totals.find((r) => r.status === "CANCELLED")?.n ?? 0;
    const returned = totals.find((r) => r.status === "RETURNED")?.n ?? 0;
    const grossProfit = revenue - cogs.cost;
    const prevRevenue = prevTotals[0]?.revenue ?? 0;
    const prevOrders = prevTotals[0]?.n ?? 0;

    // Fill empty periods so charts have a continuous axis.
    const periods = new Map<string, SalesReport["series"][number]>();
    for (const key of this.periodKeys(from, to, groupBy)) periods.set(key, { period: key, revenue: 0, orders: 0, byChannel: {} });
    const channelTotals = new Map<ChannelType, { orders: number; revenue: number }>();
    for (const r of series) {
      const p = periods.get(r.period.toISOString().slice(0, 10));
      if (p) {
        p.revenue += r.revenue;
        p.orders += r.n;
        p.byChannel[r.channel] = (p.byChannel[r.channel] ?? 0) + r.revenue;
      }
      const c = channelTotals.get(r.channel) ?? { orders: 0, revenue: 0 };
      c.orders += r.n;
      c.revenue += r.revenue;
      channelTotals.set(r.channel, c);
    }

    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const h of heat) heatmap[h.dow - 1][h.hour] = h.n;

    return {
      from: fromKey,
      to: toKey,
      groupBy,
      summary: {
        revenue,
        orders,
        aov: orders ? revenue / orders : 0,
        grossProfit,
        margin: revenue ? grossProfit / revenue : 0,
        itemsSold: cogs.items,
        cancelled,
        cancelRate: orders + cancelled ? cancelled / (orders + cancelled) : 0,
        returned,
        newCustomers,
      },
      previous: { revenue: prevRevenue, orders: prevOrders, grossProfit: prevRevenue - prevCogs.cost, aov: prevOrders ? prevRevenue / prevOrders : 0 },
      series: [...periods.values()],
      channels: [...channelTotals.entries()].map(([channel, v]) => ({ channel, ...v, share: revenue ? v.revenue / revenue : 0 })).sort((a, b) => b.revenue - a.revenue),
      locations: locations.map((l) => ({ locationId: l.id, name: l.name, orders: l.n, revenue: l.revenue })),
      products: products.map((p) => ({ name: p.name, sku: p.sku, quantity: p.quantity, revenue: p.revenue, profit: p.revenue - p.cost })),
      categories,
      staff: staff.map((s) => ({ userId: s.id, fullName: s.name, avatarUrl: s.avatar, posOrders: s.pos_n, posRevenue: s.pos_rev, handledOrders: s.handled })),
      heatmap,
    };
  }

  private async cogs(where: Prisma.Sql) {
    const [r] = await this.prisma.$queryRaw<{ items: number; cost: number }[]>`
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS items, COALESCE(SUM(oi.quantity * COALESCE(v."costPrice", 0)), 0)::float AS cost
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" LEFT JOIN "ProductVariant" v ON v.id = oi."variantId"
      WHERE ${where} AND ${VALID}`;
    return r ?? { items: 0, cost: 0 };
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
