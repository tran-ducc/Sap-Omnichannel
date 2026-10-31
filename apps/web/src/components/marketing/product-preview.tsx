"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  FileBarChart,
  Info,
  Lock,
  PackageX,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHANNELS, type ChannelKey } from "./content";
import { PHOTOS } from "./photos";

/**
 * Interactive mock of the back-office. Its visual language — notched lime
 * cards, white day pills, always-dark chart card, black pill actions — is the
 * blueprint for the real app screens (docs/ARCHITECTURE.md §6).
 */

type View = "overview" | "orders" | "pos";

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "orders", label: "Đơn hàng" },
  { id: "pos", label: "Bán tại quầy" },
];

export function ProductPreview() {
  const [view, setView] = useState<View>("overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern)
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setView(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="demo" aria-labelledby="demo-heading" className="px-3 sm:px-5">
      <div className="mx-auto max-w-[1400px] rounded-3xl bg-board p-3 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-6 px-3 pt-5 pb-6 sm:px-5 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pt-8">
          <div className="max-w-2xl">
            <h2 id="demo-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
              Mở máy lên là biết hôm nay bán ra sao
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed font-light text-muted-foreground">
              Chủ shop xem doanh thu theo kênh. Quản lý xử lý đơn. Thu ngân chỉ thấy màn hình bán hàng.
            </p>
          </div>
          <div role="tablist" aria-label="Chọn màn hình xem thử" className="inline-flex w-full gap-1 rounded-full bg-background p-1.5 sm:w-auto">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={view === t.id}
                aria-controls="preview-panel"
                tabIndex={view === t.id ? 0 : -1}
                onClick={() => setView(t.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "h-10 min-w-0 flex-1 cursor-pointer rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none sm:px-5",
                  view === t.id ? "bg-lime text-lime-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          id="preview-panel"
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          className="rounded-[28px] bg-background p-3 sm:p-4"
          style={{ ["--notch-bg" as string]: "var(--background)" }}
        >
          {view === "overview" && <OverviewView />}
          {view === "orders" && <OrdersView />}
          {view === "pos" && <PosView />}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function RoundIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("flex size-12 items-center justify-center rounded-full bg-card text-foreground", className)}>{children}</span>;
}

function ChannelTag({ ch }: { ch: ChannelKey }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="size-2 rounded-full" style={{ background: CHANNELS[ch].color }} aria-hidden />
      {CHANNELS[ch].label}
    </span>
  );
}

const TONE: Record<"ok" | "wait" | "ship", string> = {
  ok: "bg-lime text-lime-foreground",
  wait: "bg-amber-soft text-amber-ink",
  ship: "bg-muted text-foreground",
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const WEEK = [
  { d: 27, label: "T2", rev: 36 },
  { d: 28, label: "T3", rev: 42 },
  { d: 29, label: "T4", rev: 48 },
  { d: 30, label: "T5", rev: 55, today: true },
  { d: 31, label: "T6", rev: null },
  { d: 1, label: "T7", rev: null },
];

const CHANNEL_BARS: { ch: ChannelKey; orders: number; pct: number; style: "sage" | "light" | "lime" }[] = [
  { ch: "shopee", orders: 96, pct: 92, style: "sage" },
  { ch: "tiktok", orders: 81, pct: 78, style: "light" },
  { ch: "pos", orders: 74, pct: 71, style: "lime" },
];

// Smooth revenue curve for the dark card (SVG path in a 200x90 box)
const CURVE = "M0 78 C 20 76, 34 70, 50 64 S 80 60, 92 40 S 110 14, 122 22 S 140 52, 158 46 S 186 30, 200 34";

function OverviewView() {
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {/* Store profile — lime notched card */}
      <div className="relative rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6 lg:col-span-5">
        <div className="notch flex gap-2">
          <RoundIcon>
            <Bell className="size-5" aria-hidden />
            <span className="sr-only">Thông báo</span>
          </RoundIcon>
          <RoundIcon>
            <Info className="size-5" aria-hidden />
            <span className="sr-only">Thông tin</span>
          </RoundIcon>
        </div>
        <div className="flex items-center gap-3 pr-28">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-card">
            <Image src={PHOTOS.owner.src} alt="" fill sizes="48px" className="object-cover" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">Trần Thu Hà</p>
            <p className="text-sm opacity-70">Chủ cửa hàng</p>
          </div>
        </div>
        <p className="mt-8 text-3xl font-normal tracking-[-0.03em]">Linen House</p>
        <p className="mt-1 text-sm">
          <span className="opacity-70">Ngành hàng:</span> Thời trang
        </p>
        <div className="mt-6">
          <div className="h-2 rounded-full bg-card" aria-hidden>
            <div className="h-full w-[68%] rounded-full bg-lime-foreground" />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="opacity-70">Mục tiêu doanh thu tháng 10</span>
            <span className="font-medium tabular">68%</span>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-12 flex-1 items-center gap-3 rounded-full border border-lime-foreground/20 pr-4 pl-1.5 text-sm">
            <span className="flex size-9 items-center justify-center rounded-full bg-card">
              <FileBarChart className="size-4" aria-hidden />
            </span>
            Chọn báo cáo
            <ChevronDown className="ml-auto size-4" aria-hidden />
          </span>
          <span className="flex size-12 items-center justify-center rounded-full bg-lime-foreground text-lime">
            <Send className="size-5" aria-hidden />
          </span>
        </div>
      </div>

      {/* Week revenue — day pills */}
      <div className="flex flex-col rounded-3xl bg-muted p-5 sm:p-6 lg:col-span-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl leading-tight font-normal tracking-[-0.03em]">Doanh thu tuần này</p>
            <p className="mt-2 text-sm text-muted-foreground">312 đơn hôm nay, Thứ Năm 30/10</p>
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/15 px-5 text-sm">
            Tháng 10
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </div>
        <ul className="mt-auto grid grid-cols-3 gap-2 pt-6 sm:grid-cols-6">
          {WEEK.map((w) => (
            <li
              key={w.label}
              className={cn(
                "flex flex-col items-center rounded-full py-4 text-center",
                w.today ? "bg-lime text-lime-foreground" : "bg-card",
                w.rev === null && "opacity-60",
              )}
            >
              <span className="text-xl font-normal tabular">{w.d}</span>
              <span className="text-xs">{w.label}</span>
              <span className="mt-2 text-[11px] font-medium tabular">{w.rev === null ? "—" : `${w.rev} tr`}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 hidden items-center justify-around border-t border-dashed border-foreground/20 pt-0 sm:flex" aria-hidden>
          {WEEK.map((w) => (
            <span key={w.label} className={cn("-mt-1 size-2 rounded-full", w.today ? "size-2.5 bg-foreground" : "bg-foreground/30")} />
          ))}
        </div>
      </div>

      {/* Orders by channel — roadmap-style pill bars */}
      <div className="rounded-3xl bg-card p-5 sm:p-6 lg:col-span-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-3xl leading-tight font-normal tracking-[-0.03em]">
            Đơn theo
            <br />
            kênh bán
          </p>
          <span className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" aria-hidden />
            Tạo đơn
          </span>
        </div>
        <div className="relative mt-6 space-y-3">
          {/* target marker */}
          <span className="absolute top-[-10px] bottom-0 left-[75%] w-px bg-foreground" aria-hidden />
          <span className="absolute top-[-14px] left-[75%] size-2.5 -translate-x-1/2 rounded-full border-2 border-foreground bg-card" aria-hidden />
          {CHANNEL_BARS.map((b) => (
            <div key={b.ch} className="relative h-11">
              <div
                className={cn(
                  "flex h-full items-center justify-between rounded-full px-4 text-sm",
                  b.style === "sage" && "bg-sage text-sage-foreground",
                  b.style === "light" && "bg-muted",
                  b.style === "lime" && "bg-lime text-lime-foreground",
                )}
                style={{ width: `${b.pct}%` }}
              >
                <span>{CHANNELS[b.ch].label}</span>
                <span className="text-xs font-medium tabular">{b.orders} đơn</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="font-medium text-foreground">Mục tiêu 75 đơn</span>
          <span>100</span>
        </div>
      </div>

      {/* Date pill + dark revenue card */}
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
        <div className="flex items-center gap-3 rounded-full bg-muted p-2 pr-5">
          <span className="flex size-14 items-center justify-center rounded-full bg-night text-2xl font-normal text-night-foreground tabular">30</span>
          <span className="leading-tight">
            Thứ Năm,
            <br />
            Tháng 10
          </span>
        </div>
        <div className="relative flex min-h-56 flex-col overflow-hidden rounded-3xl bg-night p-5 text-night-foreground">
          <p className="text-lg">Doanh thu</p>
          <p className="inline-flex items-center gap-1 text-sm opacity-60">
            Tuần này <ChevronDown className="size-3.5" aria-hidden />
          </p>
          <svg viewBox="0 0 200 90" className="absolute inset-x-0 bottom-0 h-32 w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--lime)" stopOpacity=".35" />
                <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${CURVE} V90 H0 Z`} fill="url(#rev-fill)" />
            <path d={CURVE} fill="none" stroke="var(--lime)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute top-[38%] left-[52%] -translate-x-1/2 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground tabular">+40%</span>
          <span className="absolute top-[52%] left-[61%] size-3 -translate-x-1/2 rounded-full border-2 border-night bg-lime outline-2 outline-lime" aria-hidden />
        </div>
      </div>

      {/* Low stock (sage) + staff of the month (photo) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
        <div className="flex flex-col rounded-3xl bg-sage p-5 text-sage-foreground">
          <div className="flex items-center gap-3">
            <RoundIcon className="size-11">
              <PackageX className="size-5" aria-hidden />
            </RoundIcon>
            <span className="text-sm leading-tight">
              Mẫu sắp
              <br />
              hết hàng
            </span>
          </div>
          <p className="mt-4 text-4xl font-light tabular">
            7 <span className="text-xl opacity-70">mẫu</span>
          </p>
        </div>
        <div className="relative flex min-h-36 overflow-hidden rounded-3xl bg-muted">
          <span className="absolute top-3 left-3 flex size-11 items-center justify-center rounded-full bg-lime text-lime-foreground">
            <ArrowUpRight className="size-5" aria-hidden />
          </span>
          <div className="z-10 mt-auto p-4 pr-0 text-sm leading-tight">
            Nhân viên
            <br />
            <span className="text-base font-semibold">bán giỏi nhất</span>
            <br />
            <span className="text-muted-foreground">Gia Huy, 86 đơn</span>
          </div>
          <div className="relative ml-auto w-1/2">
            <Image src={PHOTOS.personHuy.src} alt="" fill sizes="200px" className="object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ORDER_FILTERS: { label: string; count: number; ch?: ChannelKey }[] = [
  { label: "Tất cả", count: 312 },
  { label: "Shopee", count: 96, ch: "shopee" },
  { label: "TikTok Shop", count: 81, ch: "tiktok" },
  { label: "Tại quầy", count: 74, ch: "pos" },
  { label: "Lazada", count: 33, ch: "lazada" },
  { label: "Facebook", count: 19, ch: "facebook" },
];

const ORDERS: { code: string; ch: ChannelKey; customer: string; items: number; total: number; status: string; tone: "ok" | "wait" | "ship"; staff: string }[] = [
  { code: "DH-10492", ch: "tiktok", customer: "Lê Minh Châu", items: 2, total: 459_000, status: "Chờ lấy hàng", tone: "wait", staff: "Minh Thư" },
  { code: "DH-10490", ch: "shopee", customer: "Phạm Quốc Bảo", items: 1, total: 289_000, status: "Đang giao", tone: "ship", staff: "Quang Huy" },
  { code: "DH-10489", ch: "facebook", customer: "Võ Thanh Tâm", items: 3, total: 645_000, status: "Chờ xác nhận", tone: "wait", staff: "Minh Thư" },
  { code: "DH-10488", ch: "lazada", customer: "Đặng Hải Yến", items: 1, total: 378_000, status: "Đang giao", tone: "ship", staff: "Quang Huy" },
  { code: "DH-10487", ch: "website", customer: "Trịnh Gia Hân", items: 4, total: 1_356_000, status: "Đã thanh toán", tone: "ok", staff: "Bảo Ngọc" },
  { code: "DH-10486", ch: "shopee", customer: "Hồ Đức Thắng", items: 1, total: 199_000, status: "Hoàn thành", tone: "ok", staff: "Quang Huy" },
  { code: "DH-10484", ch: "pos", customer: "Khách lẻ", items: 5, total: 1_890_000, status: "Hoàn thành", tone: "ok", staff: "Minh Thư" },
];

function OrdersView() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-3xl font-normal tracking-[-0.03em]">Đơn hàng</p>
        <div className="flex h-12 w-full items-center gap-2 rounded-full bg-muted px-5 text-sm text-muted-foreground sm:w-80">
          <Search className="size-4" aria-hidden />
          Tìm mã đơn, tên hoặc số điện thoại
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {ORDER_FILTERS.map((f, i) => (
          <li
            key={f.label}
            className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm", i === 0 ? "bg-lime text-lime-foreground" : "bg-card")}
          >
            {f.ch && <span className="size-2 rounded-full" style={{ background: CHANNELS[f.ch].color }} aria-hidden />}
            {f.label}
            <span className="font-medium tabular">{f.count}</span>
          </li>
        ))}
      </ul>
      <div className="relative overflow-x-auto rounded-3xl bg-card p-2">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-normal">Mã đơn</th>
              <th className="px-4 py-3 font-normal">Kênh</th>
              <th className="px-4 py-3 font-normal">Khách hàng</th>
              <th className="px-4 py-3 text-right font-normal">Số SP</th>
              <th className="px-4 py-3 text-right font-normal">Tổng tiền</th>
              <th className="px-4 py-3 font-normal">Trạng thái</th>
              <th className="px-4 py-3 font-normal">Phụ trách</th>
            </tr>
          </thead>
          <tbody>
            {ORDERS.map((o, i) => (
              <tr key={o.code} className={i % 2 === 0 ? "bg-muted/60" : ""}>
                <td className="rounded-l-full px-4 py-3 font-medium tabular">{o.code}</td>
                <td className="px-4 py-3">
                  <ChannelTag ch={o.ch} />
                </td>
                <td className="px-4 py-3">{o.customer}</td>
                <td className="px-4 py-3 text-right tabular">{o.items}</td>
                <td className="px-4 py-3 text-right font-medium tabular">{formatVND(o.total)}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap", TONE[o.tone])}>{o.status}</span>
                </td>
                <td className="rounded-r-full px-4 py-3 text-muted-foreground">{o.staff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------------

const POS_PRODUCTS = [
  { name: "Áo linen cổ tàu", price: 385_000, stock: 24, selected: true },
  { name: "Quần ống suông đũi", price: 420_000, stock: 31, selected: true },
  { name: "Đầm suông cổ vuông", price: 560_000, stock: 12 },
  { name: "Áo sơ mi tay lỡ", price: 345_000, stock: 40 },
  { name: "Chân váy xếp ly", price: 395_000, stock: 9 },
  { name: "Túi cói quai da", price: 290_000, stock: 2 },
  { name: "Khăn lụa vuông", price: 180_000, stock: 56, selected: true },
  { name: "Mũ bucket linen", price: 160_000, stock: 18 },
];

const CART = [
  { name: "Áo linen cổ tàu", variant: "Be, M", qty: 1, price: 385_000 },
  { name: "Quần ống suông đũi", variant: "Đen, S", qty: 1, price: 420_000 },
  { name: "Khăn lụa vuông", variant: "Họa tiết sen", qty: 2, price: 180_000 },
];

function PosView() {
  const subtotal = CART.reduce((s, i) => s + i.qty * i.price, 0);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-3 rounded-3xl bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-muted px-5 text-sm text-muted-foreground">
            <Search className="size-4" aria-hidden />
            Quét mã vạch hoặc tìm sản phẩm (F2)
          </div>
          <span className="inline-flex h-12 items-center gap-2 rounded-full bg-muted pr-4 pl-1.5 text-sm">
            <span className="relative size-9 overflow-hidden rounded-full">
              <Image src={PHOTOS.personHuy.src} alt="" fill sizes="36px" className="object-cover" />
            </span>
            Gia Huy, Nhân viên
          </span>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {["Tất cả", "Áo", "Quần", "Đầm, váy", "Phụ kiện"].map((c, i) => (
            <li key={c} className={cn("inline-flex h-10 items-center rounded-full px-4", i === 0 ? "bg-primary text-primary-foreground" : "bg-card")}>
              {c}
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {POS_PRODUCTS.map((p) => (
            <li key={p.name} className={cn("rounded-3xl p-4", p.selected ? "bg-lime text-lime-foreground" : "bg-card")}>
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="mt-6 text-lg font-normal tabular">{formatVND(p.price)}</p>
              <p className={cn("text-xs tabular", p.stock <= 5 ? "font-medium text-amber-ink" : "opacity-60")}>còn {p.stock}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col rounded-3xl bg-card p-5">
        <p className="text-2xl font-normal tracking-[-0.02em]">Hoá đơn HD-2291</p>
        <p className="mt-1 text-sm text-muted-foreground">Khách: Nguyễn Ngọc Anh, 1.240 điểm</p>
        <ul className="mt-4 space-y-2">
          {CART.map((c) => (
            <li key={c.name} className="flex items-center gap-3 rounded-2xl bg-muted p-3 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-xs font-medium tabular">{c.qty}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.variant}</p>
              </div>
              <span className="font-medium tabular">{formatVND(c.qty * c.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tạm tính</dt>
            <dd className="tabular">{formatVND(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Giảm giá</dt>
            <dd className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden />
              Cần quyền Quản lý
            </dd>
          </div>
          <div className="flex items-baseline justify-between pt-2">
            <dt>Khách cần trả</dt>
            <dd className="text-3xl font-light tracking-tight tabular">{formatVND(subtotal)}</dd>
          </div>
        </dl>
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-full bg-muted p-1.5 text-xs font-medium">
          {["Tiền mặt", "QR", "Thẻ"].map((m, i) => (
            <span key={m} className={cn("rounded-full py-2 text-center", i === 1 && "bg-card")}>
              {m}
            </span>
          ))}
        </div>
        <span className="mt-4 flex h-14 items-center justify-center rounded-full bg-primary text-base font-medium text-primary-foreground lg:mt-auto">
          Thanh toán {formatVND(subtotal)}
        </span>
      </div>
    </div>
  );
}
