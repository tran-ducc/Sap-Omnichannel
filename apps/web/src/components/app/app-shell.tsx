"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Lock, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRealtimeStatus } from "@/hooks/use-realtime";
import { initials, ROLE_LABEL } from "@/lib/domain";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { NAV, NAV_GROUP_LABEL, navFor } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { useSession } from "./session-provider";
import { EmptyState } from "./states";

/**
 * Authenticated frame: guards the /app routes, renders the role-filtered
 * sidebar (drawer below lg — staff often work on tablets) and the top bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  // One realtime connection while signed in (stock and channel-sync updates).
  useEffect(() => {
    if (status !== "authenticated") return;
    connectRealtime();
    return () => disconnectRealtime();
  }, [status]);

  // Close the drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  if (status !== "authenticated" || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Đang tải phiên làm việc</span>
      </div>
    );
  }

  const current = NAV.find((n) => pathname.startsWith(`/app/${n.slug}`));
  const title = current?.label ?? (pathname.startsWith("/app/account") ? "Tài khoản" : "Sạp");

  return (
    <div className="flex min-h-dvh gap-3 p-3 sm:p-4">
      <a href="#app-main" className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Bỏ qua, tới nội dung chính
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Drawer (tablet / phone) */}
      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-1 sm:px-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            aria-expanded={drawerOpen}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-card focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <p className="truncate text-lg font-medium lg:text-xl">{title}</p>
          <div className="ml-auto flex items-center gap-1.5">
            <LiveIndicator />
            <ThemeToggle className="bg-card" />
            <NotificationBell />
            <Link
              href="/app/account"
              aria-label="Tài khoản của tôi"
              className="ml-1 flex items-center gap-2 rounded-full bg-card p-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:pr-4"
            >
              <Avatar name={session.user.fullName} url={session.user.avatarUrl} className="size-8" />
              <span className="hidden text-sm leading-tight sm:block">
                <span className="block font-medium">{session.user.fullName}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</span>
              </span>
            </Link>
          </div>
        </header>
        <main id="app-main" className="flex-1 pt-2 pb-6" tabIndex={-1}>
          {current && !current.anyOf.some((p) => session.permissions.includes(p)) ? (
            <EmptyState icon={Lock} title="Bạn không có quyền xem mục này" body={`Vai trò ${ROLE_LABEL[session.role]} không truy cập được ${current.label.toLowerCase()}. Hỏi quản lý cửa hàng nếu bạn cần quyền.`} className="bg-card" />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

/** Shows whether stock updates are arriving live; text and dot, not colour alone. */
function LiveIndicator() {
  const connected = useRealtimeStatus();
  return (
    <span
      role="status"
      className={cn("mr-1 hidden items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs md:inline-flex", !connected && "text-muted-foreground")}
      title={connected ? "Tồn kho và đơn hàng đang cập nhật trực tiếp" : "Mất kết nối trực tiếp, đang thử kết nối lại"}
    >
      <span className={cn("size-2 rounded-full", connected ? "bg-success animate-pulse" : "bg-muted-foreground/50")} aria-hidden />
      {connected ? "Trực tiếp" : "Đang kết nối lại"}
    </span>
  );
}

export function Avatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny avatar from user data, any host
    <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-lime text-xs font-semibold text-lime-foreground", className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

function Sidebar() {
  const { session, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  if (!session) return null;
  const items = navFor(session.permissions);
  const groups = (["main", "manage", "system"] as const).map((g) => ({ g, items: items.filter((i) => i.group === g) })).filter((x) => x.items.length);

  return (
    <nav aria-label="Điều hướng ứng dụng" className="flex h-full flex-col overflow-y-auto rounded-3xl bg-board p-3">
      <div className="px-2 pt-2 pb-4">
        <Link href="/app/dashboard" className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Logo />
        </Link>
        <p className="mt-3 truncate text-sm font-medium">{session.tenant.name}</p>
      </div>

      {groups.map(({ g, items }) => (
        <div key={g} className="mt-2">
          <p className="px-3 pb-1 text-xs text-muted-foreground">{NAV_GROUP_LABEL[g]}</p>
          <ul className="space-y-0.5">
            {items.map(({ slug, label, icon: Icon }) => {
              const active = pathname.startsWith(`/app/${slug}`);
              return (
                <li key={slug}>
                  <Link
                    href={`/app/${slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-full px-3.5 text-[15px] transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      active ? "bg-lime font-medium text-lime-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5">
          <Avatar name={session.user.fullName} url={session.user.avatarUrl} className="size-9" />
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <p className="truncate font-medium">{session.user.fullName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</p>
          </div>
          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await logout();
              router.replace("/login");
            }}
            aria-label="Đăng xuất"
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
          >
            {leaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
    </nav>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Đóng menu" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-night/45 animate-in fade-in" />
      <div className="relative h-full w-[min(20rem,85vw)] p-3 animate-in slide-in-from-left duration-200">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng menu"
          className="absolute top-6 right-6 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </button>
        <Sidebar />
      </div>
    </div>
  );
}
