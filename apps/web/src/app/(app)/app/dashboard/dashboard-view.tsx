"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, FileBarChart, History, PackageCheck, PackageX, RotateCw, ShoppingCart } from "lucide-react";
import { DASHBOARD_RANGES, type DashboardOverview, type DashboardRange, type KpiPair } from "@omni/shared";
import { Avatar } from "@/components/app/app-shell";
import { RevenueChart } from "@/components/app/revenue-chart";
import { useSession } from "@/components/app/session-provider";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { CHANNEL_META, ORDER_STATUS, ROLE_LABEL, TONE_CLASS } from "@/lib/domain";
import { formatNumber, formatVND, formatVNDCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGE_LABEL: Record<DashboardRange, string> = { today: "Hôm nay", "7d": "7 ngày", "30d": "30 ngày" };
const COMPARE_LABEL: Record<DashboardRange, string> = {
  today: "so với cùng giờ hôm qua",
  "7d": "so với 7 ngày trước đó",
  "30d": "so với 30 ngày trước đó",
};
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function DashboardView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("range");
  const range: DashboardRange = DASHBOARD_RANGES.includes(raw as DashboardRange) ? (raw as DashboardRange) : "today";
  const { data, error, loading, reload } = useApiQuery<DashboardOverview>(`/reports/overview?range=${range}`);

  const setRange = (r: DashboardRange) => router.replace(r === "today" ? pathname : `${pathname}?range=${r}`, { scroll: false });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div role="radiogroup" aria-label="Khoảng thời gian" className="inline-flex gap-1 rounded-full bg-card p-1">
          {DASHBOARD_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "h-10 cursor-pointer rounded-full px-5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                range === r ? "bg-lime font-medium text-lime-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {loading && data ? "Đang cập nhật…" : data ? `Cập nhật lúc ${new Date(data.generatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
      </div>

      {error && data && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Không tải được số liệu mới: {error.message}
          <button type="button" onClick={reload} className="ml-auto cursor-pointer font-medium underline underline-offset-4">
            Thử lại
          </button>
        </div>
      )}

      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : data.scope === "summary" ? (
        <StaffDashboard data={data} />
      ) : (
        <FullDashboard data={data} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin / Manager
// ---------------------------------------------------------------------------

function FullDashboard({ data }: { data: DashboardOverview }) {
  const brandNew = data.recentOrders.length === 0 && data.monthRevenue === 0;
  return (
    <div className="grid gap-3 lg:grid-cols-12" style={{ ["--notch-bg" as string]: "var(--background)" }}>
      {brandNew && <GettingStarted />}
      <StoreCard data={data} className="lg:col-span-5" />
      <KpiGrid data={data} className="lg:col-span-7" />
      <DayPills data={data} className="lg:col-span-7" />
      <div className="flex min-h-64 flex-col rounded-3xl bg-night p-5 text-night-foreground sm:p-6 lg:col-span-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg">Doanh thu</h2>
            <p className="text-sm opacity-60">7 ngày gần nhất</p>
          </div>
          <span className="rounded-full bg-card px-3 py-1 text-sm font-medium text-foreground tabular">{formatVNDCompact(sum(data.daily))}</span>
        </div>
        <div className="mt-auto">
          <RevenueChart daily={data.daily} />
        </div>
      </div>
      <ChannelBars data={data} className="lg:col-span-5" />
      <RecentOrders data={data} className="lg:col-span-7" />
      <LowStockCard data={data} className="lg:col-span-4" />
      <TopProducts data={data} className="lg:col-span-4" />
      <TopSellerCard data={data} className="lg:col-span-4" />
    </div>
  );
}

const sum = (days: DashboardOverview["daily"]) => days.reduce((s, d) => s + d.total, 0);

/** Lime profile card with the notched corner from the app reference. */
function StoreCard({ data, className }: { data: DashboardOverview; className?: string }) {
  const { session } = useSession();
  if (!session) return null;
  const progress = data.lastMonthRevenue ? data.monthRevenue / data.lastMonthRevenue : 0;
  return (
    <section aria-label="Cửa hàng" className={cn("relative flex flex-col rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6", className)}>
      <div className="notch flex gap-2">
        <Link href="/app/notifications" aria-label="Thông báo" className="flex size-12 items-center justify-center rounded-full bg-card text-foreground hover:bg-muted">
          <Bell className="size-5" aria-hidden />
        </Link>
        <Link href="/app/activity" aria-label="Nhật ký hoạt động" className="flex size-12 items-center justify-center rounded-full bg-card text-foreground hover:bg-muted">
          <History className="size-5" aria-hidden />
        </Link>
      </div>
      <div className="flex items-center gap-3 pr-28">
        <Avatar name={session.user.fullName} url={session.user.avatarUrl} className="size-12 bg-card" />
        <div className="min-w-0">
          <p className="truncate font-medium">{session.user.fullName}</p>
          <p className="text-sm opacity-70">{ROLE_LABEL[session.role]}</p>
        </div>
      </div>
      <h2 className="mt-8 text-3xl font-normal tracking-[-0.03em]">{session.tenant.name}</h2>
      <p className="mt-1 text-sm">
        <span className="opacity-70">Doanh thu tháng này:</span> <span className="font-medium tabular">{formatVND(data.monthRevenue)}</span>
      </p>
      <div className="mt-6">
        <div
          className="h-2 overflow-hidden rounded-full bg-card"
          role="progressbar"
          aria-label="So với cùng kỳ tháng trước"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(progress, 1) * 100)}
        >
          <div className="h-full rounded-full bg-lime-foreground" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="opacity-70">So với cùng kỳ tháng trước</span>
          <span className="font-medium tabular">{data.lastMonthRevenue ? `${Math.round(progress * 100)}%` : "—"}</span>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 lg:mt-auto lg:pt-6">
        <Link href="/app/reports" className="flex h-12 flex-1 items-center gap-3 rounded-full border border-lime-foreground/20 pr-4 pl-1.5 text-sm hover:bg-card/40">
          <span className="flex size-9 items-center justify-center rounded-full bg-card text-foreground">
            <FileBarChart className="size-4" aria-hidden />
          </span>
          Xem báo cáo chi tiết
        </Link>
        <Link href="/app/pos" aria-label="Mở bán tại quầy" className="flex size-12 items-center justify-center rounded-full bg-lime-foreground text-lime hover:opacity-90">
          <ShoppingCart className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function KpiGrid({ data, className }: { data: DashboardOverview; className?: string }) {
  const k = data.kpis;
  const cmp = COMPARE_LABEL[data.range];
  return (
    <section aria-label="Chỉ số chính" className={cn("grid grid-cols-2 gap-3", className)}>
      <Kpi label="Doanh thu" value={formatVND(k.revenue.current)} pair={k.revenue} compare={cmp} />
      <Kpi label="Đơn hàng" value={formatNumber(k.orders.current)} pair={k.orders} compare={cmp} />
      <Kpi label="Giá trị đơn trung bình" value={formatVND(k.aov.current)} pair={k.aov} compare={cmp} />
      <Kpi label="Tỷ lệ huỷ đơn" value={`${(k.cancelRate.current * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} pair={k.cancelRate} compare={cmp} lowerIsBetter points />
    </section>
  );
}

function Kpi({ label, value, pair, compare, lowerIsBetter, points }: { label: string; value: string; pair: KpiPair; compare: string; lowerIsBetter?: boolean; points?: boolean }) {
  return (
    <div className="flex min-h-36 flex-col rounded-3xl bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-auto pt-4 text-2xl font-light tracking-[-0.03em] tabular sm:text-3xl">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <TrendBadge pair={pair} lowerIsBetter={lowerIsBetter} points={points} />
        <span className="text-xs text-muted-foreground">{compare}</span>
      </div>
    </div>
  );
}

/** Change vs previous period. Good = lime, bad = amber; arrow and sign carry the meaning too. */
function TrendBadge({ pair, lowerIsBetter, points, className }: { pair: KpiPair; lowerIsBetter?: boolean; points?: boolean; className?: string }) {
  const diff = pair.current - pair.previous;
  if (pair.previous === 0 && pair.current === 0) {
    return <span className={cn("rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground", className)}>Chưa có số liệu</span>;
  }
  if (!points && pair.previous === 0) {
    return <span className={cn("rounded-full bg-lime px-2 py-0.5 text-xs font-medium text-lime-foreground", className)}>Mới</span>;
  }
  const value = points ? diff * 100 : (diff / pair.previous) * 100;
  const up = diff > 0;
  const good = diff === 0 || (lowerIsBetter ? !up : up);
  const text = `${up ? "+" : diff < 0 ? "−" : ""}${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}${points ? " điểm" : "%"}`;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular", good ? "bg-lime text-lime-foreground" : "bg-amber-soft text-amber-ink", className)}>
      {diff !== 0 && <Icon className="size-3.5" aria-hidden />}
      {text}
    </span>
  );
}

/** Day pills (app reference "Upcoming meetings") showing order counts for the last 7 days. */
function DayPills({ data, className }: { data: DashboardOverview; className?: string }) {
  const max = Math.max(1, ...data.daily.map((d) => d.orders));
  return (
    <section aria-labelledby="days-heading" className={cn("flex flex-col rounded-3xl bg-muted p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="days-heading" className="text-2xl leading-tight font-normal tracking-[-0.03em] sm:text-3xl">
            Đơn hàng theo ngày
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{formatNumber(data.daily.reduce((s, d) => s + d.orders, 0))} đơn trong 7 ngày qua</p>
        </div>
      </div>
      <ol className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.daily.map((d, i) => {
          const date = new Date(`${d.date}T00:00:00`);
          const today = i === data.daily.length - 1;
          return (
            <li
              key={d.date}
              className={cn("flex flex-col items-center rounded-full px-1 py-4 text-center", today ? "bg-lime text-lime-foreground" : "bg-card")}
              aria-current={today ? "date" : undefined}
            >
              <span className="text-xl font-normal tabular">{date.getDate()}</span>
              <span className="text-xs">{today ? "Hôm nay" : WEEKDAY[date.getDay()]}</span>
              <span className="mt-2 text-sm font-medium tabular">{formatNumber(d.orders)}</span>
              <span className="sr-only">đơn</span>
            </li>
          );
        })}
      </ol>
      {/* dotted timeline under the pills, height of the dot = relative volume */}
      <div className="mt-4 hidden grid-cols-7 border-t border-dashed border-foreground/20 sm:grid" aria-hidden>
        {data.daily.map((d, i) => (
          <span key={d.date} className="flex justify-center">
            <span className={cn("-mt-1 rounded-full", i === data.daily.length - 1 ? "size-2.5 bg-foreground" : "size-2 bg-foreground/30")} style={{ opacity: 0.4 + (d.orders / max) * 0.6 }} />
          </span>
        ))}
      </div>
    </section>
  );
}

/** Roadmap-style pill bars (app reference) for channel share over 7 days. */
function ChannelBars({ data, className }: { data: DashboardOverview; className?: string }) {
  const max = Math.max(1, ...data.channelShare.map((c) => c.revenue));
  const total = data.channelShare.reduce((s, c) => s + c.revenue, 0);
  const styles = ["bg-sage text-sage-foreground", "bg-muted", "bg-lime text-lime-foreground"];
  return (
    <section aria-labelledby="channels-heading" className={cn("rounded-3xl bg-card p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <h2 id="channels-heading" className="text-2xl leading-tight font-normal tracking-[-0.03em] sm:text-3xl">
          Doanh thu
          <br />
          theo kênh
        </h2>
        <Link href="/app/orders" className={buttonVariants({ size: "md" })}>
          Xem đơn
        </Link>
      </div>
      {data.channelShare.length === 0 ? (
        <EmptyInline text="Chưa có đơn nào trong 7 ngày qua." />
      ) : (
        <ul className="mt-6 space-y-2.5">
          {data.channelShare.map((c, i) => (
            <li key={c.channel} className="h-11">
              <div
                className={cn("flex h-full min-w-fit items-center justify-between gap-3 rounded-full px-4 text-sm", styles[i % styles.length])}
                style={{ width: `${Math.max(38, (c.revenue / max) * 100)}%` }}
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="size-2 rounded-full ring-2 ring-card/60" style={{ background: CHANNEL_META[c.channel].color }} aria-hidden />
                  {CHANNEL_META[c.channel].label}
                </span>
                <span className="text-xs font-medium whitespace-nowrap tabular">
                  {formatVNDCompact(c.revenue)}, {Math.round((c.revenue / total) * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentOrders({ data, className, title = "Đơn hàng mới" }: { data: DashboardOverview; className?: string; title?: string }) {
  return (
    // min-w-0: as a grid item it would otherwise grow to the table's min-width on phones
    <section aria-labelledby="recent-heading" className={cn("min-w-0 rounded-3xl bg-card p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between">
        <h2 id="recent-heading" className="text-xl font-normal tracking-[-0.02em]">
          {title}
        </h2>
        <Link href="/app/orders" className="text-sm font-medium underline-offset-4 hover:underline">
          Tất cả đơn
        </Link>
      </div>
      {data.recentOrders.length === 0 ? (
        <EmptyInline text="Chưa có đơn hàng nào." />
      ) : (
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 pb-2 font-normal">Mã đơn</th>
                <th className="px-3 pb-2 font-normal">Kênh</th>
                <th className="px-3 pb-2 font-normal">Khách hàng</th>
                <th className="px-3 pb-2 text-right font-normal">Tổng tiền</th>
                <th className="px-3 pb-2 font-normal">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? "bg-muted/60" : ""}>
                  <td className="rounded-l-full px-3 py-2.5 font-medium tabular">{o.code}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="size-2 rounded-full" style={{ background: CHANNEL_META[o.channelType].color }} aria-hidden />
                      {CHANNEL_META[o.channelType].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{o.customerName ?? <span className="text-muted-foreground">Khách lẻ</span>}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular">{formatVND(o.total)}</td>
                  <td className="rounded-r-full px-3 py-2.5">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", TONE_CLASS[ORDER_STATUS[o.status].tone])}>{ORDER_STATUS[o.status].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LowStockCard({ data, className }: { data: DashboardOverview; className?: string }) {
  const ok = data.lowStockCount === 0;
  return (
    <section aria-labelledby="low-heading" className={cn("flex flex-col rounded-3xl p-5 sm:p-6", ok ? "bg-card" : "bg-sage text-sage-foreground", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-card text-foreground">
          {ok ? <PackageCheck className="size-5" aria-hidden /> : <PackageX className="size-5" aria-hidden />}
        </span>
        <h2 id="low-heading" className="text-sm leading-tight">
          Mẫu sắp
          <br />
          hết hàng
        </h2>
        <p className="ml-auto text-4xl font-light tabular">{data.lowStockCount}</p>
      </div>
      {ok ? (
        <p className="mt-6 text-sm text-muted-foreground">Tồn kho ở mọi chi nhánh đều trên mức tối thiểu.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {data.lowStock.map((s) => (
            <li key={`${s.variantId}-${s.location}`} className="flex items-center gap-3 rounded-2xl bg-card/15 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{s.name}</p>
                <p className="truncate text-xs opacity-75">{s.location}</p>
              </div>
              <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-foreground tabular">còn {s.available}</span>
            </li>
          ))}
        </ul>
      )}
      {!ok && (
        <Link href="/app/inventory" className="mt-4 text-sm font-medium underline underline-offset-4 lg:mt-auto lg:pt-4">
          Mở tồn kho để nhập hàng
        </Link>
      )}
    </section>
  );
}

function TopProducts({ data, className }: { data: DashboardOverview; className?: string }) {
  const max = Math.max(1, ...data.topProducts.map((p) => p.quantity));
  return (
    <section aria-labelledby="top-heading" className={cn("rounded-3xl bg-card p-5 sm:p-6", className)}>
      <h2 id="top-heading" className="text-xl font-normal tracking-[-0.02em]">
        Bán chạy 7 ngày
      </h2>
      {data.topProducts.length === 0 ? (
        <EmptyInline text="Chưa có sản phẩm nào được bán." />
      ) : (
        <ol className="mt-4 space-y-3">
          {data.topProducts.map((p, i) => (
            <li key={p.name}>
              <div className="flex items-baseline gap-3 text-sm">
                <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-medium tabular">{formatNumber(p.quantity)}</span>
              </div>
              <div className="mt-1 ml-7 h-1.5 rounded-full bg-muted" aria-hidden>
                <div className={cn("h-full rounded-full", i === 0 ? "bg-lime" : "bg-foreground/70")} style={{ width: `${(p.quantity / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Photo card (app reference "AI Smart Assistant"). */
function TopSellerCard({ data, className }: { data: DashboardOverview; className?: string }) {
  const s = data.topSeller;
  return (
    <section aria-labelledby="seller-heading" className={cn("relative flex min-h-56 overflow-hidden rounded-3xl bg-muted", className)}>
      <span className="absolute top-4 left-4 z-10 flex size-11 items-center justify-center rounded-full bg-lime text-lime-foreground">
        <ArrowUpRight className="size-5" aria-hidden />
      </span>
      <div className="z-10 mt-auto p-5 pr-0">
        <h2 id="seller-heading" className="text-sm leading-tight">
          Nhân viên
          <br />
          <span className="text-lg font-semibold">bán giỏi nhất</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{s ? `${s.name}, ${formatNumber(s.orders)} đơn tháng này` : "Chưa có đơn tại quầy tháng này"}</p>
      </div>
      {s?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user data
        <img src={s.avatarUrl.replace("w=200&h=200", "w=400&h=500")} alt={`Ảnh ${s.name}`} className="ml-auto w-1/2 object-cover" />
      ) : (
        s && <Avatar name={s.name} url={null} className="m-auto mr-6 size-24 text-2xl" />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

function StaffDashboard({ data }: { data: DashboardOverview }) {
  const { session } = useSession();
  return (
    <div className="grid gap-3 lg:grid-cols-12" style={{ ["--notch-bg" as string]: "var(--background)" }}>
      <section aria-label="Ca làm việc" className="relative flex flex-col rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6 lg:col-span-5">
        <div className="notch">
          <Link href="/app/notifications" aria-label="Thông báo" className="flex size-12 items-center justify-center rounded-full bg-card text-foreground hover:bg-muted">
            <Bell className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="flex items-center gap-3 pr-16">
          {session && <Avatar name={session.user.fullName} url={session.user.avatarUrl} className="size-12 bg-card" />}
          <div className="min-w-0">
            <p className="truncate font-medium">{session?.user.fullName}</p>
            <p className="text-sm opacity-70">Nhân viên, {session?.tenant.name}</p>
          </div>
        </div>
        <h2 className="mt-8 text-3xl font-normal tracking-[-0.03em]">Sẵn sàng bán hàng</h2>
        <p className="mt-2 text-sm opacity-75">Số liệu bên cạnh chỉ tính các đơn bạn tạo hoặc được phân công.</p>
        <Link href="/app/pos" className={cn(buttonVariants({ size: "xl" }), "mt-8 bg-lime-foreground text-lime hover:bg-lime-foreground/85 lg:mt-auto")}>
          <ShoppingCart className="size-4" aria-hidden />
          Mở màn hình bán hàng
        </Link>
      </section>
      <KpiGrid data={data} className="lg:col-span-7" />
      <RecentOrders data={data} title="Đơn của bạn" className="lg:col-span-12" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

/** Shown to a shop with no orders yet: the empty dashboard becomes a checklist. */
function GettingStarted() {
  const steps = [
    { href: "/app/products", title: "Thêm sản phẩm", body: "Nhập tay hoặc tải file Excel có sẵn." },
    { href: "/app/settings", title: "Kết nối kênh bán", body: "Shopee, Lazada, TikTok Shop, Facebook." },
    { href: "/app/pos", title: "Bán đơn đầu tiên", body: "Mở màn hình bán tại quầy trên máy tính hoặc tablet." },
  ];
  return (
    <section aria-labelledby="start-heading" className="rounded-3xl bg-night p-5 text-night-foreground sm:p-6 lg:col-span-12">
      <h2 id="start-heading" className="text-2xl font-normal tracking-[-0.02em]">
        Cửa hàng đã sẵn sàng. Bắt đầu với ba bước sau:
      </h2>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full items-start gap-3 rounded-2xl bg-night-foreground/8 p-4 transition-colors hover:bg-night-foreground/14">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium", i === 0 ? "bg-lime text-lime-foreground" : "bg-night-foreground/15")}>{i + 1}</span>
              <span>
                <span className="block font-medium">{s.title}</span>
                <span className="mt-0.5 block text-sm opacity-65">{s.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="mt-6 rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-[50dvh] flex-col items-center justify-center rounded-3xl bg-board p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-amber-soft text-amber-ink">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h2 className="mt-5 text-2xl font-normal tracking-[-0.02em]">Không tải được trang tổng quan</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} className={cn(buttonVariants({ size: "xl" }), "mt-6")}>
        <RotateCw className="size-4" aria-hidden />
        Thử lại
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  const block = "animate-pulse rounded-3xl bg-card/70";
  return (
    <div className="grid gap-3 lg:grid-cols-12" aria-busy="true" aria-label="Đang tải số liệu">
      <div className={cn(block, "h-72 bg-lime/40 lg:col-span-5")} />
      <div className="grid grid-cols-2 gap-3 lg:col-span-7">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(block, "h-36")} />
        ))}
      </div>
      <div className={cn(block, "h-64 lg:col-span-7")} />
      <div className={cn(block, "h-64 bg-night/20 lg:col-span-5")} />
      <div className={cn(block, "h-72 lg:col-span-5")} />
      <div className={cn(block, "h-72 lg:col-span-7")} />
    </div>
  );
}
