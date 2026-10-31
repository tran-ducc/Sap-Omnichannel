"use client";

import type { ActivityItem, Page, RoleKey } from "@omni/shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History } from "lucide-react";
import { Pagination, Segmented } from "@/components/app/controls";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/app/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { ORDER_STATUS, ROLE_LABEL } from "@/lib/domain";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "ALL", label: "Tất cả" },
  { value: "Order", label: "Đơn hàng" },
  { value: "ProductVariant", label: "Kho và giá" },
  { value: "Product", label: "Sản phẩm" },
  { value: "PosSession", label: "Ca bán" },
  { value: "User", label: "Nhân viên" },
  { value: "Customer", label: "Khách hàng" },
  { value: "Location", label: "Chi nhánh" },
  { value: "Channel", label: "Kênh bán" },
  { value: "Tenant", label: "Cửa hàng" },
];

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "đăng nhập",
  "customer.updated": "sửa thông tin khách",
  "inventory.adjusted": "điều chỉnh tồn kho",
  "inventory.transferred": "chuyển kho",
  "order.assigned": "phân công đơn",
  "order.created": "tạo đơn",
  "order.status_changed": "đổi trạng thái đơn",
  "pos.shift_opened": "mở ca bán",
  "pos.shift_closed": "đóng ca bán",
  "product.archived": "ngừng bán sản phẩm",
  "product.created": "thêm sản phẩm",
  "product.price_changed": "đổi giá bán",
  "settings.channel_updated": "cập nhật kênh bán",
  "settings.location_created": "thêm chi nhánh",
  "settings.location_updated": "cập nhật chi nhánh",
  "settings.store_updated": "đổi thông tin cửa hàng",
  "staff.added": "thêm nhân viên",
  "staff.password_reset": "đặt lại mật khẩu cho nhân viên",
  "staff.updated": "sửa quyền nhân viên",
  "tenant.created": "tạo cửa hàng",
  "tenant.seeded": "tạo dữ liệu mẫu",
};

const STATUS_WORD: Record<string, string> = { ACTIVE: "mở khoá", DISABLED: "khoá tài khoản", CONNECTED: "kết nối", DISCONNECTED: "ngắt kết nối" };

/** Readable one-line detail from the free-form metadata the API writes. */
function detail(a: ActivityItem): string | null {
  const m = a.metadata ?? {};
  const s = (k: string) => (typeof m[k] === "string" || typeof m[k] === "number" ? String(m[k]) : null);
  const parts: string[] = [];
  const name = s("code") ?? s("name") ?? s("sku") ?? s("fullName") ?? s("email");
  if (name) parts.push(name);
  if (s("from") && s("to") && a.action === "order.status_changed") parts.push(`${ORDER_STATUS[s("from") as keyof typeof ORDER_STATUS]?.label ?? s("from")} → ${ORDER_STATUS[s("to") as keyof typeof ORDER_STATUS]?.label ?? s("to")}`);
  if (typeof m.oldPrice === "number" && typeof m.newPrice === "number") parts.push(`${formatVND(m.oldPrice)} → ${formatVND(m.newPrice)}`);
  if (typeof m.delta === "number") parts.push(`${m.delta > 0 ? "+" : ""}${formatNumber(m.delta)}`);
  if (typeof m.quantity === "number" && a.action === "inventory.transferred") parts.push(`${formatNumber(m.quantity)} sp`);
  if (s("role")) parts.push(`vai trò ${ROLE_LABEL[s("role") as RoleKey] ?? s("role")}`);
  if (s("status") && a.action !== "order.status_changed") parts.push(STATUS_WORD[s("status")!] ?? s("status")!);
  if (typeof m.isActive === "boolean") parts.push(m.isActive ? "mở lại" : "ngừng hoạt động");
  if (typeof m.discrepancy === "number" && m.discrepancy !== 0) parts.push(`lệch ${formatVND(m.discrepancy)}`);
  if (s("reason")) parts.push(s("reason")!);
  return parts.length ? parts.join(", ") : null;
}

function link(a: ActivityItem) {
  if (!a.entityId) return null;
  if (a.entityType === "Order") return `/app/orders/${a.entityId}`;
  if (a.entityType === "Product") return `/app/products/${a.entityId}`;
  if (a.entityType === "Customer") return `/app/customers?id=${a.entityId}`;
  return null;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

export function ActivityView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const type = params.get("type") ?? "ALL";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const { data, error, loading, reload } = useApiQuery<Page<ActivityItem>>(`/activity?${new URLSearchParams({ page: String(page), limit: "50", ...(type !== "ALL" && { entityType: type }) })}`);

  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const a of data?.items ?? []) {
    const day = dayKey(a.createdAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(a);
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto rounded-3xl bg-card p-3">
        <Segmented label="Lọc theo loại" value={type} onChange={(v) => set({ type: v === "ALL" ? null : v, page: null })} options={FILTERS} className="w-fit flex-nowrap" />
      </div>
      <section aria-label="Nhật ký hoạt động" className="rounded-3xl bg-card p-4 sm:p-6">
        {!data && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <RowsSkeleton rows={8} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="Chưa có hoạt động" body="Thao tác của nhân viên như đổi giá, điều chỉnh kho hay đổi trạng thái đơn sẽ được ghi lại ở đây." />
        ) : (
          <>
            <p className="pb-2 text-xs text-muted-foreground" aria-live="polite">
              {loading ? "Đang cập nhật…" : `${formatNumber(data.total)} hoạt động`}
            </p>
            {groups.map((g) => (
              <div key={g.day} className="mb-6 last:mb-0">
                <h2 className="mb-2 text-sm text-muted-foreground first-letter:uppercase">{g.day}</h2>
                <ol className="relative space-y-0.5 before:absolute before:top-3 before:bottom-3 before:left-[4.75rem] before:w-px before:bg-border">
                  {g.items.map((a) => {
                    const d = detail(a);
                    const href = link(a);
                    return (
                      <li key={a.id} className="relative flex gap-4 py-2 text-sm">
                        <time dateTime={a.createdAt} className="w-14 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular">
                          {new Date(a.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        <span className={cn("relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card", a.action.startsWith("order") ? "bg-lime-foreground" : a.action.startsWith("staff") || a.action.startsWith("settings") ? "bg-amber" : "bg-muted-foreground/60")} aria-hidden />
                        <p className="min-w-0 flex-1">
                          <span className="font-medium">{a.actor?.fullName ?? "Hệ thống"}</span> {ACTION_LABEL[a.action] ?? a.action}
                          {d &&
                            (href ? (
                              <>
                                {" "}
                                <Link href={href} className="underline decoration-border underline-offset-4 hover:decoration-foreground">
                                  {d}
                                </Link>
                              </>
                            ) : (
                              <span className="text-muted-foreground"> {d}</span>
                            ))}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
            <Pagination page={page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>
    </div>
  );
}
