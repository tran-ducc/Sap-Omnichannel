"use client";

import type { NotificationList } from "@omni/shared";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/app/controls";
import { NotificationRow, openNotification } from "@/components/app/notification-bell";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";

export function NotificationsView() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, error, reload, mutate } = useApiQuery<NotificationList>(`/notifications?limit=100${filter === "unread" ? "&unread=true" : ""}`);
  useRealtime("notification.created", reload);

  async function readAll() {
    mutate((d) => ({ unread: 0, items: filter === "unread" ? [] : d.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) }));
    await api("/notifications/read-all", { method: "POST" }).catch(reload);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-card p-3">
        <Segmented
          label="Lọc thông báo"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "unread", label: `Chưa đọc${data?.unread ? ` (${data.unread})` : ""}` },
          ]}
        />
        <button type="button" onClick={readAll} disabled={!data?.unread} className={buttonVariants({ variant: "outline", size: "md", className: "ml-auto" })}>
          <CheckCheck className="size-4" aria-hidden />
          Đọc hết
        </button>
      </div>
      <section aria-label="Danh sách thông báo" className="rounded-3xl bg-card p-2 sm:p-3">
        {!data && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <RowsSkeleton rows={6} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={BellOff} title={filter === "unread" ? "Đã đọc hết" : "Chưa có thông báo"} body="Đơn mới từ sàn, hàng sắp hết, lệch tiền cuối ca và lỗi đồng bộ sẽ hiện ở đây." />
        ) : (
          <ul className="space-y-1">
            {data.items.map((n) => (
              <li key={n.id}>
                <NotificationRow
                  n={n}
                  onOpen={() => {
                    mutate((d) => ({ unread: Math.max(0, d.unread - (n.readAt ? 0 : 1)), items: d.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) }));
                    openNotification(n, router.push);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
