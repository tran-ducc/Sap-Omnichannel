"use client";

import type { ChannelType, OrderEvent, OrderList, OrderStatus } from "@omni/shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Inbox, Loader2, Plus, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pagination, SearchBox, Segmented } from "@/components/app/controls";
import { ChannelTag, PaymentPill, PersonChip, StatusPill } from "@/components/app/order-bits";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { CHANNEL_META } from "@/lib/domain";
import { formatNumber, formatVND, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Range = "today" | "7d" | "30d" | "all";
const STATUS_TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PROCESSING", label: "Đóng gói" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã huỷ" },
  { value: "RETURNED", label: "Trả hàng" },
];
const CHANNELS: ChannelType[] = ["POS", "SHOPEE", "TIKTOK_SHOP", "LAZADA", "FACEBOOK", "WEBSITE"];

export function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can, inScope } = useSession();

  const status = (params.get("status") as OrderStatus | null) ?? null;
  const channel = (params.get("channel") as ChannelType | null) ?? null;
  const range = (["today", "7d", "30d", "all"].includes(params.get("range") ?? "") ? params.get("range") : "7d") as Range;
  const mine = params.get("assigned") === "me";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim(), 300);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const lastQ = useRef(q);
  useEffect(() => {
    if (lastQ.current === q) return;
    lastQ.current = q;
    setParams({ q: q || null });
    // setParams reads the live URL; only q changes here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = new URLSearchParams({ page: String(page), limit: "25", range, ...(q && { q }), ...(status && { status }), ...(channel && { channel }), ...(mine && { assigned: "me" }) });
  const { data, error, loading, reload } = useApiQuery<OrderList>(`/orders?${query}`);

  // Live: new orders refresh page 1 automatically (and flash); elsewhere a banner offers to reload.
  const [incoming, setIncoming] = useState<OrderEvent[]>([]);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoRefresh = page === 1 && !q;
  useRealtime<OrderEvent>("order.created", (e) => {
    if (!inScope(e.locationId)) return; // other branch: not visible to branch-limited staff
    setIncoming((list) => [e, ...list].slice(0, 5));
    if (autoRefresh) {
      setFlash((s) => new Set(s).add(e.orderId));
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 400);
    }
  });
  useRealtime<OrderEvent>("order.updated", (e) => {
    if (data?.items.some((o) => o.id === e.orderId)) {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 400);
    }
  });
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  // Re-render relative times every minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState("");
  async function simulate() {
    setSimulating(true);
    setSimError("");
    try {
      await api("/orders/simulate", { method: "POST", json: {} });
    } catch (e) {
      setSimError((e as Error).message);
    } finally {
      setSimulating(false);
    }
  }

  const counts = data?.counts;
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 xl:flex-row xl:items-center">
        <SearchBox value={search} onChange={setSearch} label="Tìm đơn hàng" placeholder="Mã đơn, mã sàn, tên hoặc SĐT" className="xl:w-80" />
        <Segmented
          label="Khoảng thời gian"
          value={range}
          onChange={(v) => setParams({ range: v === "7d" ? null : v })}
          options={[
            { value: "today", label: "Hôm nay" },
            { value: "7d", label: "7 ngày" },
            { value: "30d", label: "30 ngày" },
            { value: "all", label: "Tất cả" },
          ]}
          className="relative w-fit max-w-full flex-nowrap overflow-x-auto"
        />
        {can("order:read_all") && (
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setParams({ assigned: mine ? null : "me" })}
            className={cn("h-10 w-fit cursor-pointer rounded-full px-4 text-sm whitespace-nowrap transition-colors", mine ? "bg-lime font-medium text-lime-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            Được giao cho tôi
          </button>
        )}
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          {can("channel:manage") && (
            <button type="button" onClick={simulate} disabled={simulating} className={buttonVariants({ variant: "outline", size: "md" })} title="Tạo một đơn giả lập như sàn gửi về, để thử luồng xử lý">
              {simulating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Zap className="size-4" aria-hidden />}
              Giả lập đơn từ sàn
            </button>
          )}
          {can("order:create") && (
            <Link href="/app/orders/new" className={buttonVariants({ size: "md" })}>
              <Plus className="size-4" aria-hidden />
              Tạo đơn
            </Link>
          )}
        </div>
      </div>
      {simError && <InlineError message={simError} />}

      {/* New-order banner when not auto-refreshing */}
      {incoming.length > 0 && !autoRefresh && (
        <button
          type="button"
          onClick={() => {
            setIncoming([]);
            setSearch("");
            setParams({ page: null, q: null });
          }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-lime px-5 py-3 text-left text-sm text-lime-foreground"
        >
          <Bell className="size-4" aria-hidden />
          {incoming.length} đơn mới vừa về, gần nhất {incoming[0].code} từ {CHANNEL_META[incoming[0].channelType].label}. Bấm để xem.
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {incoming[0] ? `Đơn mới ${incoming[0].code} từ ${CHANNEL_META[incoming[0].channelType].label}, ${formatVND(incoming[0].total)}` : ""}
      </p>

      {/* Status tabs + channel chips */}
      <div className="space-y-2">
        <div className="relative -mx-1 overflow-x-auto px-1 pb-1">
          <div role="tablist" aria-label="Lọc theo trạng thái" className="inline-flex gap-1 rounded-full bg-card p-1">
            {STATUS_TABS.map((t) => {
              const active = (status ?? "ALL") === t.value;
              const n = counts?.byStatus[t.value];
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParams({ status: t.value === "ALL" ? null : t.value })}
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
                    active ? "bg-lime font-medium text-lime-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                  {n !== undefined && <span className={cn("rounded-full px-1.5 text-xs tabular", active ? "bg-lime-foreground/10" : "bg-muted")}>{formatNumber(n)}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Lọc theo kênh bán">
          {CHANNELS.map((c) => {
            const active = channel === c;
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParams({ channel: active ? null : c })}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                    active ? "bg-night text-night-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: CHANNEL_META[c].color }} aria-hidden />
                  {CHANNEL_META[c].label}
                  <span className="text-xs tabular">{formatNumber(counts?.byChannel[c] ?? 0)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Table */}
      <section aria-label="Danh sách đơn hàng" className="rounded-3xl bg-card p-3 sm:p-4">
        {!data && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <RowsSkeleton rows={8} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={q ? "Không tìm thấy đơn phù hợp" : "Chưa có đơn nào"}
            body={q ? `Không có đơn nào khớp “${q}”.` : range === "today" ? "Hôm nay chưa có đơn. Đơn từ quầy và các sàn sẽ hiện ở đây ngay khi có." : "Thử đổi bộ lọc trạng thái, kênh hoặc khoảng thời gian."}
          />
        ) : (
          <>
            <p className="px-3 pb-2 text-xs text-muted-foreground" aria-live="polite">
              {loading ? "Đang cập nhật…" : `${formatNumber(data.total)} đơn`}
            </p>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Mã đơn
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Kênh
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Khách hàng
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Tổng tiền
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Thanh toán
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Trạng thái
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Phụ trách
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Thời gian
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o, i) => (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/app/orders/${o.id}`)}
                      className={cn("cursor-pointer transition-colors hover:bg-lime-soft", i % 2 === 0 && "bg-muted/50", flash.has(o.id) && "animate-flash-lime")}
                    >
                      <th scope="row" className="rounded-l-[20px] px-3 py-3 text-left font-normal">
                        <Link href={`/app/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-medium tabular hover:underline">
                          {o.code}
                        </Link>
                        {o.externalOrderId && <span className="block text-xs text-muted-foreground tabular">{o.externalOrderId}</span>}
                      </th>
                      <td className="px-3 py-3">
                        <ChannelTag channel={o.channelType} />
                      </td>
                      <td className="px-3 py-3">
                        {o.customerName ?? <span className="text-muted-foreground">Khách lẻ</span>}
                        {o.customerPhone && <span className="block text-xs text-muted-foreground tabular">{o.customerPhone}</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-medium tabular">{formatVND(o.total)}</span>
                        <span className="block text-xs text-muted-foreground">{o.itemCount} sản phẩm</span>
                      </td>
                      <td className="px-3 py-3">
                        <PaymentPill status={o.paymentStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-3 py-3">
                        <PersonChip person={o.assignedTo} empty={o.channelType === "POS" ? "Tại quầy" : "Chưa phân công"} />
                      </td>
                      <td className="rounded-r-[20px] px-3 py-3 text-right text-xs whitespace-nowrap text-muted-foreground">{timeAgo(o.placedAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>
    </div>
  );
}
