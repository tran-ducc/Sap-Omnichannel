"use client";

import type { ChannelSyncedEvent, InventoryChangedEvent, InventoryList, InventoryRow, LocationSummary, StockLevel } from "@omni/shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Boxes, History, PackageSearch, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pagination, SearchBox, Segmented } from "@/components/app/controls";
import { useSession } from "@/components/app/session-provider";
import { AdjustStockDialog, MovementHistoryDialog, TransferStockDialog, type StockTarget } from "@/components/app/stock-dialogs";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/app/states";
import { SyncStatus } from "@/components/app/sync-status";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtime } from "@/hooks/use-realtime";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const MOVEMENT_VERB: Record<InventoryChangedEvent["movementType"], string> = {
  PURCHASE: "nhập",
  SALE: "bán",
  RETURN: "nhận trả",
  ADJUSTMENT: "điều chỉnh",
  TRANSFER_IN: "nhận chuyển",
  TRANSFER_OUT: "chuyển đi",
  RESERVE: "giữ",
  RELEASE: "nhả",
};

function patchLevels(levels: StockLevel[], next: StockLevel) {
  return levels.some((l) => l.locationId === next.locationId) ? levels.map((l) => (l.locationId === next.locationId ? next : l)) : [...levels, next];
}

export function InventoryView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can, inScope } = useSession();

  const locationId = params.get("location") ?? "";
  const lowOnly = params.get("low") === "1";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim(), 300);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page"); // any filter change returns to page 1
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Keep ?q= in sync with the debounced search box.
  const lastQ = useRef(q);
  useEffect(() => {
    if (lastQ.current === q) return;
    lastQ.current = q;
    const next = new URLSearchParams(window.location.search);
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [q, pathname, router]);

  const query = new URLSearchParams({ page: String(page), limit: "25", ...(q && { q }), ...(locationId && { locationId }), ...(lowOnly && { lowStock: "true" }) });
  const { data, error, loading, reload, mutate } = useApiQuery<InventoryList>(`/inventory?${query}`);
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");

  // Rows touched by a realtime event flash briefly (key changes restart the animation).
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [liveNote, setLiveNote] = useState("");
  const summaryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useRealtime<InventoryChangedEvent>("inventory.changed", (e) => {
    // Events are shop-wide; branch-limited staff ignore other branches.
    if (!inScope(e.level.locationId)) return;
    mutate((d) => ({ ...d, items: d.items.map((r) => (r.variantId === e.variantId ? { ...r, levels: patchLevels(r.levels, e.level) } : r)) }));
    setFlash((f) => ({ ...f, [e.variantId]: Date.now() }));
    const row = data?.items.find((r) => r.variantId === e.variantId);
    const loc = locations.find((l) => l.id === e.level.locationId)?.name;
    if (row) setLiveNote(`${e.actorName ?? "Hệ thống"} vừa ${MOVEMENT_VERB[e.movementType]} ${formatNumber(Math.abs(e.quantity))} ${row.productName}, ${row.variantName}${loc ? ` tại ${loc}` : ""}.`);
    // Summary numbers come from the server; refresh them once the burst settles.
    clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(reload, 1500);
  });
  useRealtime<ChannelSyncedEvent>("channel.synced", (e) => {
    mutate((d) => ({ ...d, items: d.items.map((r) => (r.variantId === e.variantId ? { ...r, listings: e.listings } : r)) }));
  });
  useEffect(() => () => clearTimeout(summaryTimer.current), []);

  const [adjusting, setAdjusting] = useState<StockTarget | null>(null);
  const [transferring, setTransferring] = useState<StockTarget | null>(null);
  const [history, setHistory] = useState<StockTarget | null>(null);
  const toTarget = (r: InventoryRow): StockTarget => ({ variantId: r.variantId, label: `${r.productName}, ${r.variantName}`, sku: r.sku, levels: r.levels });
  const applyLevels = (variantId: string, levels: StockLevel[]) =>
    mutate((d) => ({ ...d, items: d.items.map((r) => (r.variantId === variantId ? { ...r, levels: levels.reduce(patchLevels, r.levels) } : r)) }));

  const columns = locationId ? locations.filter((l) => l.id === locationId) : locations;
  const canAdjust = can("inventory:adjust");
  const canTransfer = can("inventory:transfer");
  const s = data?.summary;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <section aria-label="Tổng quan tồn kho" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Mẫu đang bán" value={s ? formatNumber(s.skuCount) : "—"} />
        <Stat label="Tổng số lượng tồn" value={s ? formatNumber(s.totalOnHand) : "—"} />
        <button
          type="button"
          onClick={() => setParams({ low: lowOnly ? null : "1" })}
          aria-pressed={lowOnly}
          className={cn(
            "flex min-h-28 cursor-pointer flex-col rounded-3xl p-5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            lowOnly ? "bg-lime text-lime-foreground" : "bg-card hover:bg-muted",
          )}
        >
          <span className={cn("text-sm", lowOnly ? "opacity-75" : "text-muted-foreground")}>Sắp hết hàng</span>
          <span className="mt-auto pt-3 text-3xl font-light tracking-[-0.03em] tabular">{s ? formatNumber(s.lowStock) : "—"}</span>
          <span className="text-xs">{lowOnly ? "Đang lọc, bấm để bỏ lọc" : "Bấm để xem"}</span>
        </button>
        <Stat label="Hết hàng" value={s ? formatNumber(s.outOfStock) : "—"} tone={s && s.outOfStock > 0 ? "warn" : undefined} />
        {s?.stockValue != null ? (
          <div className="col-span-2 flex min-h-28 flex-col rounded-3xl bg-night p-5 text-night-foreground lg:col-span-1">
            <span className="text-sm opacity-65">Giá trị tồn kho (giá vốn)</span>
            <span className="mt-auto pt-3 text-2xl font-light tracking-[-0.03em] tabular">{formatVND(s.stockValue)}</span>
          </div>
        ) : (
          s && <Stat label="Chi nhánh và kho" value={formatNumber(locations.length)} />
        )}
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} label="Tìm sản phẩm" placeholder="Tìm tên, SKU hoặc mã vạch" className="lg:w-96" />
        <div className="relative -mx-1 overflow-x-auto px-1">
          <Segmented
            label="Lọc theo chi nhánh"
            value={locationId || "all"}
            onChange={(v) => setParams({ location: v === "all" ? null : v })}
            options={[{ value: "all", label: "Tất cả kho" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            className="flex-nowrap"
          />
        </div>
      </div>
      <p className="min-h-4 px-4 text-xs text-muted-foreground" aria-live="polite">
        {loading && data ? "Đang cập nhật…" : liveNote}
      </p>

      {/* Table */}
      <section aria-label="Danh sách tồn kho" className="rounded-3xl bg-card p-3 sm:p-4">
        {!data && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <RowsSkeleton rows={8} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={lowOnly ? Boxes : PackageSearch}
            title={lowOnly ? "Không có mẫu nào sắp hết" : q ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
            body={lowOnly ? "Tồn kho ở mọi chi nhánh đều trên mức tối thiểu." : q ? `Không có kết quả cho “${q}”. Thử tên khác hoặc mã SKU.` : "Thêm sản phẩm để bắt đầu theo dõi tồn kho."}
            action={
              !q && !lowOnly && can("product:create") ? (
                <Link href="/app/products/new" className={buttonVariants({ size: "md" })}>
                  Thêm sản phẩm
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Sản phẩm
                    </th>
                    {columns.map((l) => (
                      <th key={l.id} scope="col" className="px-3 pb-3 text-right font-normal">
                        {l.name}
                      </th>
                    ))}
                    {!locationId && (
                      <th scope="col" className="px-3 pb-3 text-right font-normal">
                        Tổng
                      </th>
                    )}
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Kênh bán
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r, i) => (
                    <tr key={`${r.variantId}-${flash[r.variantId] ?? 0}`} className={cn(i % 2 === 0 && "bg-muted/50", flash[r.variantId] && "animate-flash-lime")}>
                      <th scope="row" className="rounded-l-[20px] px-3 py-3 text-left font-normal">
                        <Link href={`/app/products/${r.productId}`} className="font-medium hover:underline">
                          {r.productName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {r.variantName}, <span className="tabular">{r.sku}</span>
                        </span>
                      </th>
                      {columns.map((l) => (
                        <td key={l.id} className="px-3 py-3 text-right">
                          <StockCell level={r.levels.find((x) => x.locationId === l.id)} />
                        </td>
                      ))}
                      {!locationId && <td className="px-3 py-3 text-right font-medium tabular">{formatNumber(r.levels.reduce((s, l) => s + l.available, 0))}</td>}
                      <td className="px-3 py-3">
                        <SyncStatus listings={r.listings} />
                      </td>
                      <td className="rounded-r-[20px] px-3 py-3">
                        <div className="flex justify-end gap-1">
                          {canAdjust && (
                            <IconAction label={`Điều chỉnh tồn ${r.productName}, ${r.variantName}`} onClick={() => setAdjusting(toTarget(r))}>
                              <SlidersHorizontal className="size-4" aria-hidden />
                            </IconAction>
                          )}
                          {canTransfer && (
                            <IconAction label={`Chuyển kho ${r.productName}, ${r.variantName}`} onClick={() => setTransferring(toTarget(r))}>
                              <ArrowLeftRight className="size-4" aria-hidden />
                            </IconAction>
                          )}
                          <IconAction label={`Lịch sử tồn kho ${r.productName}, ${r.variantName}`} onClick={() => setHistory(toTarget(r))}>
                            <History className="size-4" aria-hidden />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>

      <AdjustStockDialog target={adjusting} locations={locations} defaultLocationId={locationId || undefined} onClose={() => setAdjusting(null)} onDone={(id, level) => applyLevels(id, [level])} />
      <TransferStockDialog target={transferring} locations={locations} onClose={() => setTransferring(null)} onDone={applyLevels} />
      <MovementHistoryDialog target={history} onClose={() => setHistory(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={cn("flex min-h-28 flex-col rounded-3xl p-5", tone === "warn" ? "bg-amber-soft text-amber-ink" : "bg-card")}>
      <span className={cn("text-sm", tone ? "opacity-80" : "text-muted-foreground")}>{label}</span>
      <span className="mt-auto pt-3 text-3xl font-light tracking-[-0.03em] tabular">{value}</span>
    </div>
  );
}

/** Available stock with a text badge when low or out (never colour alone). */
function StockCell({ level }: { level?: StockLevel }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const out = level.available <= 0;
  const low = !out && level.onHand <= level.reorderPoint;
  return (
    <span className="inline-flex flex-col items-end gap-0.5" title={`Tồn thực tế ${level.onHand}, đang giữ ${level.reserved}, mức tối thiểu ${level.reorderPoint}`}>
      <span className="inline-flex items-center gap-1.5">
        {out && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Hết</span>}
        {low && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-ink">Sắp hết</span>}
        <span className="text-[15px] font-medium tabular">{formatNumber(level.available)}</span>
      </span>
      {level.reserved > 0 && <span className="text-[11px] text-muted-foreground tabular">giữ {formatNumber(level.reserved)}</span>}
    </span>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label.split(" ").slice(0, 3).join(" ")}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-lime hover:text-lime-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
