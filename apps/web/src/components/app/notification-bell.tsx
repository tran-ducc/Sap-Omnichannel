"use client";

import type { NotificationItem, NotificationList, NotificationType } from "@omni/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, PackageMinus, Receipt, RefreshCwOff, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_ICON: Record<NotificationType, typeof Bell> = {
  "order.new": Receipt,
  "stock.low": PackageMinus,
  "shift.discrepancy": Wallet,
  "sync.failed": RefreshCwOff,
};

/** Marks one notification read, then follows its link. */
export async function openNotification(n: NotificationItem, go: (href: string) => void) {
  if (!n.readAt) await api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => undefined);
  if (n.href) go(n.href);
}

/** Header bell: unread badge kept live over the socket, with a short popover of the latest items. */
export function NotificationBell() {
  const router = useRouter();
  const { data, reload, mutate } = useApiQuery<NotificationList>("/notifications?limit=6");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useRealtime<{ title: string }>("notification.created", (n) => {
    reload();
    setToast(n.title);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  });
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  async function readAll() {
    mutate((d) => ({ unread: 0, items: d.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) }));
    await api("/notifications/read-all", { method: "POST" }).catch(reload);
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => (setOpen((o) => !o), open || reload())}
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-[11px] font-semibold text-lime-foreground tabular ring-2 ring-background" aria-hidden>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Thông báo mới" className="absolute top-12 right-0 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl bg-card p-2 shadow-xl ring-1 ring-border">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <p className="font-medium">Thông báo</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          {!data ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : data.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
          ) : (
            <ul>
              {data.items.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    n={n}
                    compact
                    onOpen={() => {
                      setOpen(false);
                      mutate((d) => ({ unread: Math.max(0, d.unread - (n.readAt ? 0 : 1)), items: d.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) }));
                      openNotification(n, router.push);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-full bg-muted py-2.5 text-center text-sm hover:bg-border">
            Xem tất cả
          </Link>
        </div>
      )}

      {toast && (
        <p role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-2 rounded-full bg-night py-3 pr-5 pl-4 text-sm text-night-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <Bell className="size-4 shrink-0 text-lime" aria-hidden />
          {toast}
        </p>
      )}
    </div>
  );
}

export function NotificationRow({ n, onOpen, compact }: { n: NotificationItem; onOpen: () => void; compact?: boolean }) {
  const Icon = NOTIFICATION_ICON[n.type] ?? AlertTriangle;
  const warn = n.type !== "order.new";
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full cursor-pointer items-start gap-3 rounded-2xl text-left hover:bg-muted", compact ? "p-3" : "p-4", !n.readAt && "bg-lime-soft/60")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", warn ? "bg-amber-soft text-amber-ink" : "bg-lime text-lime-foreground")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className={cn("block", !n.readAt && "font-medium")}>{n.title}</span>
        {n.body && <span className={cn("block text-muted-foreground", compact && "truncate")}>{n.body}</span>}
        <span className="mt-0.5 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.readAt && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-lime-foreground" aria-label="Chưa đọc" role="img" />
      )}
    </button>
  );
}
