"use client";

import type { LocationSummary, SalesReport } from "@omni/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented, SelectField } from "@/components/app/controls";
import { Avatar } from "@/components/app/app-shell";
import { ChannelTag } from "@/components/app/order-bits";
import { ErrorState, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { downloadCsv } from "@/lib/csv";
import { CHANNEL_META } from "@/lib/domain";
import { formatNumber, formatVND, formatVNDCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

type Preset = "7d" | "30d" | "90d" | "month" | "lastMonth" | "custom";
const VN = 7 * 3_600_000;
const todayKey = () => new Date(Date.now() + VN).toISOString().slice(0, 10);
const shift = (key: string, days: number) => new Date(Date.parse(key) + days * 86_400_000).toISOString().slice(0, 10);

function presetRange(p: Exclude<Preset, "custom">): [string, string] {
  const t = todayKey();
  if (p === "7d") return [shift(t, -6), t];
  if (p === "30d") return [shift(t, -29), t];
  if (p === "90d") return [shift(t, -89), t];
  const [y, m] = t.split("-").map(Number);
  if (p === "month") return [`${y}-${String(m).padStart(2, "0")}-01`, t];
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

const GROUPS = [
  { label: "Tại quầy", color: "var(--chart-1)", channels: ["POS"] },
  { label: "Sàn TMĐT", color: "var(--chart-2)", channels: ["SHOPEE", "LAZADA", "TIKTOK_SHOP"] },
  { label: "Mạng xã hội", color: "var(--chart-4)", channels: ["FACEBOOK"] },
  { label: "Website", color: "var(--chart-3)", channels: ["WEBSITE"] },
] as const;

function periodLabel(key: string, groupBy: SalesReport["groupBy"]) {
  const [y, m, d] = key.split("-");
  return groupBy === "month" ? `T${Number(m)}/${y.slice(2)}` : groupBy === "week" ? `Tuần ${d}/${m}` : `${d}/${m}`;
}

export function ReportsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const preset = (params.get("preset") as Preset) ?? "30d";
  const [from, to] = preset === "custom" ? [params.get("from") ?? presetRange("30d")[0], params.get("to") ?? todayKey()] : presetRange(preset);
  const locationId = params.get("location") ?? "";

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");
  const { data, error, loading, reload } = useApiQuery<SalesReport>(`/reports/sales?${new URLSearchParams({ from, to, ...(locationId && { locationId }) })}`);

  const chart = data?.series.map((s) => ({
    name: periodLabel(s.period, data.groupBy),
    ...Object.fromEntries(GROUPS.map((g) => [g.label, g.channels.reduce((sum, c) => sum + (s.byChannel[c] ?? 0), 0)])),
    orders: s.orders,
  }));

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `bao-cao-${data.from}-${data.to}.csv`,
      ["Kỳ", "Doanh thu", "Số đơn", ...GROUPS.map((g) => g.label)],
      data.series.map((s) => [s.period, Math.round(s.revenue), s.orders, ...GROUPS.map((g) => Math.round(g.channels.reduce((sum, c) => sum + (s.byChannel[c] ?? 0), 0)))]),
    );
  }

  function exportProducts() {
    if (!data) return;
    downloadCsv(
      `san-pham-ban-chay-${data.from}-${data.to}.csv`,
      ["Sản phẩm", "SKU", "Số lượng", "Doanh thu", "Lợi nhuận gộp", "Lợi nhuận ước tính"],
      data.products.map((p) => [p.name, p.sku, p.quantity, Math.round(p.revenue), Math.round(p.profit), p.profitEstimated ? "Có" : "Không"]),
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 xl:flex-row xl:items-end">
        <div className="relative -mx-1 overflow-x-auto px-1">
          <Segmented
            label="Khoảng thời gian"
            value={preset}
            onChange={(v) => set({ preset: v === "30d" ? null : v, ...(v !== "custom" && { from: null, to: null }), ...(v === "custom" && { from, to }) })}
            options={[
              { value: "7d", label: "7 ngày" },
              { value: "30d", label: "30 ngày" },
              { value: "90d", label: "90 ngày" },
              { value: "month", label: "Tháng này" },
              { value: "lastMonth", label: "Tháng trước" },
              { value: "custom", label: "Tuỳ chọn" },
            ]}
            className="w-fit flex-nowrap"
          />
        </div>
        {preset === "custom" && (
          <div className="flex gap-2">
            <DateInput label="Từ ngày" value={from} max={to} onChange={(v) => set({ from: v })} />
            <DateInput label="Đến ngày" value={to} min={from} max={todayKey()} onChange={(v) => set({ to: v })} />
          </div>
        )}
        <SelectField label="Chi nhánh" hideLabel value={locationId} onChange={(e) => set({ location: e.target.value || null })} className="xl:w-56">
          <option value="">Tất cả chi nhánh và kênh</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <button type="button" onClick={exportCsv} disabled={!data} className={cn(buttonVariants({ variant: "outline", size: "md" }), "xl:ml-auto")}>
          <Download className="size-4" aria-hidden />
          Xuất CSV
        </button>
      </div>
      <p className="px-4 text-xs text-muted-foreground" aria-live="polite">
        {loading && data ? "Đang cập nhật…" : data ? `Từ ${data.from.split("-").reverse().join("/")} đến ${data.to.split("-").reverse().join("/")}, so với ${data.series.length} ${data.groupBy === "day" ? "ngày" : data.groupBy === "week" ? "tuần" : "tháng"} liền trước` : ""}
      </p>

      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={8} className="rounded-3xl bg-card p-4" />
      ) : (
        <>
          {/* KPIs */}
          <section aria-label="Chỉ số chính" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Doanh thu" value={formatVND(data.summary.revenue)} cur={data.summary.revenue} prev={data.previous.revenue} dark />
            <Kpi
              label={data.summary.costEstimatedItems ? "Lợi nhuận gộp (ước tính)" : "Lợi nhuận gộp"}
              value={formatVND(data.summary.grossProfit)}
              cur={data.summary.grossProfit}
              prev={data.previous.grossProfit}
              note={`Biên ${(data.summary.margin * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%${data.summary.costEstimatedItems ? `, ${formatNumber(data.summary.costEstimatedItems)} sp tính theo giá vốn hiện tại` : ""}`}
            />
            <Kpi label="Đơn hàng" value={formatNumber(data.summary.orders)} cur={data.summary.orders} prev={data.previous.orders} note={`${formatNumber(data.summary.itemsSold)} sản phẩm`} />
            <Kpi label="Giá trị đơn trung bình" value={formatVND(data.summary.aov)} cur={data.summary.aov} prev={data.previous.aov} note={`${formatNumber(data.summary.newCustomers)} khách mới, huỷ ${(data.summary.cancelRate * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} />
          </section>

          {/* Revenue chart */}
          <section aria-labelledby="rev-h" className="rounded-3xl bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="rev-h" className="text-xl font-normal tracking-[-0.02em]">
                Doanh thu theo {data.groupBy === "day" ? "ngày" : data.groupBy === "week" ? "tuần" : "tháng"}
              </h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {GROUPS.map((g) => (
                  <li key={g.label} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: g.color }} aria-hidden />
                    {g.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 h-72" role="img" aria-label={`Biểu đồ doanh thu từ ${data.from} đến ${data.to}, tổng ${formatVND(data.summary.revenue)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatVNDCompact(Number(v))} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, fontSize: 13 }}
                    formatter={(v, name) => [formatVND(Number(v)), name]}
                  />
                  {GROUPS.map((g, i) => (
                    <Bar key={g.label} dataKey={g.label} stackId="rev" fill={g.color} radius={i === GROUPS.length - 1 ? [6, 6, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-12">
            {/* Channels */}
            <section aria-labelledby="ch-h" className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 lg:col-span-5">
              <h2 id="ch-h" className="text-xl font-normal tracking-[-0.02em]">
                Theo kênh bán
              </h2>
              <ul className="mt-4 space-y-3">
                {data.channels.map((c) => (
                  <li key={c.channel}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <ChannelTag channel={c.channel} />
                      <span className="tabular">
                        <span className="font-medium">{formatVNDCompact(c.revenue)}</span>
                        <span className="text-muted-foreground">, {formatNumber(c.orders)} đơn</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${c.share * 100}%`, background: CHANNEL_META[c.channel].color }} />
                    </div>
                  </li>
                ))}
              </ul>
              {data.locations.length > 1 && (
                <>
                  <h3 className="mt-6 text-sm text-muted-foreground">Theo chi nhánh xuất hàng</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {data.locations.map((l) => (
                      <li key={l.locationId} className="flex justify-between gap-3">
                        <span>{l.name}</span>
                        <span className="tabular">{formatVNDCompact(l.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Heatmap */}
            <section aria-labelledby="heat-h" className="min-w-0 rounded-3xl bg-night p-5 text-night-foreground sm:p-6 lg:col-span-7">
              <h2 id="heat-h" className="text-xl font-normal tracking-[-0.02em]">
                Khung giờ đông khách
              </h2>
              <p className="text-sm opacity-60">Số đơn theo thứ và giờ, giờ Việt Nam</p>
              <Heatmap heat={data.heatmap} />
            </section>

            {/* Top products */}
            <section aria-labelledby="prod-h" className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 lg:col-span-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="prod-h" className="text-xl font-normal tracking-[-0.02em]">
                  Sản phẩm bán chạy
                </h2>
                <button type="button" onClick={exportProducts} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Download className="size-4" aria-hidden />
                  CSV
                </button>
              </div>
              <div className="relative mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 pb-2 font-normal">Sản phẩm</th>
                      <th className="px-3 pb-2 text-right font-normal">Đã bán</th>
                      <th className="px-3 pb-2 text-right font-normal">Doanh thu</th>
                      <th className="px-3 pb-2 text-right font-normal">Lợi nhuận gộp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.slice(0, 10).map((p, i) => (
                      <tr key={p.sku} className={i % 2 === 0 ? "bg-muted/50" : ""}>
                        <td className="rounded-l-full px-3 py-2.5">
                          {p.name}
                          <span className="block text-xs text-muted-foreground tabular">{p.sku}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{formatNumber(p.quantity)}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular">{formatVND(p.revenue)}</td>
                        <td className="rounded-r-full px-3 py-2.5 text-right tabular">
                          {formatVND(p.profit)}
                          <span className="block text-xs text-muted-foreground">
                            {p.revenue ? Math.round((p.profit / p.revenue) * 100) : 0}%{p.profitEstimated && ", ước tính"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Lợi nhuận gộp tính theo giá vốn lưu lại lúc bán. Đơn bán trước khi có tính năng này chưa lưu giá vốn nên được ước tính theo giá vốn hiện tại.
              </p>
            </section>

            {/* Categories */}
            <section aria-labelledby="cat-h" className="rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6 lg:col-span-4">
              <h2 id="cat-h" className="text-xl font-normal tracking-[-0.02em]">
                Theo danh mục
              </h2>
              <ul className="mt-4 space-y-3">
                {data.categories.map((c) => (
                  <li key={c.name} className="flex items-baseline justify-between gap-3 border-b border-lime-foreground/15 pb-2 text-sm last:border-0">
                    <span>{c.name}</span>
                    <span className="tabular">
                      <span className="font-medium">{formatVNDCompact(c.revenue)}</span>
                      <span className="opacity-60">, {formatNumber(c.quantity)} sp</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Staff */}
            <section aria-labelledby="staff-h" className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 lg:col-span-12">
              <h2 id="staff-h" className="text-xl font-normal tracking-[-0.02em]">
                Nhân viên
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {data.staff.map((s, i) => (
                  <li key={s.userId} className={cn("flex items-center gap-3 rounded-2xl p-3", i === 0 ? "bg-lime-soft" : "bg-muted/70")}>
                    <Avatar name={s.fullName} url={s.avatarUrl} className="size-10" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(s.posOrders)} đơn tại quầy, xử lý {formatNumber(s.handledOrders)} đơn online
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular">{formatVNDCompact(s.posRevenue)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function DateInput({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input type="date" value={value} min={min} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-10 rounded-full border border-input bg-card px-4 tabular outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
    </label>
  );
}

function Kpi({ label, value, cur, prev, note, dark }: { label: string; value: string; cur: number; prev: number; note?: string; dark?: boolean }) {
  const pct = prev ? ((cur - prev) / prev) * 100 : null;
  const up = pct !== null && pct >= 0;
  return (
    <div className={cn("flex min-h-36 flex-col rounded-3xl p-4 sm:p-5", dark ? "bg-night text-night-foreground" : "bg-card")}>
      <p className={cn("text-sm", dark ? "opacity-65" : "text-muted-foreground")}>{label}</p>
      <p className="mt-auto pt-3 text-[clamp(1.05rem,4.6vw,1.875rem)] font-light tracking-[-0.03em] tabular lg:text-[clamp(1.25rem,1.9vw,1.875rem)]">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {pct !== null && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium tabular", up ? "bg-lime text-lime-foreground" : "bg-amber-soft text-amber-ink")}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {up ? "+" : "−"}
            {Math.abs(pct).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
          </span>
        )}
        {note && <span className={dark ? "opacity-65" : "text-muted-foreground"}>{note}</span>}
      </div>
    </div>
  );
}

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00–22:00

function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  let best = { n: 0, d: 0, h: 0 };
  heat.forEach((row, d) => row.forEach((n, h) => n > best.n && (best = { n, d, h })));
  return (
    <figure className="mt-4">
      <div className="relative overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-[auto_repeat(15,1fr)] gap-1 text-[11px]" aria-hidden>
          <span />
          {HOURS.map((h) => (
            <span key={h} className="text-center opacity-60 tabular">
              {h}
            </span>
          ))}
          {DAYS.map((day, d) => (
            <div key={day} className="contents">
              <span className="pr-1.5 leading-6 opacity-60">{day}</span>
              {HOURS.map((h) => (
                <span key={h} title={`${day} ${h}h: ${heat[d][h]} đơn`} className="h-6 rounded-md bg-lime" style={{ opacity: 0.08 + (heat[d][h] / max) * 0.92 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-sm opacity-75">
        Đông nhất: {DAYS[best.d]} lúc {best.h} giờ với {formatNumber(best.n)} đơn.
      </figcaption>
    </figure>
  );
}
