"use client";

import { Check, Pause, Play, Plus, Shirt, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CHANNELS, type ChannelKey } from "./content";

/**
 * Hero demo: one shared stock number fanned out to every sales channel.
 * Each simulated order decrements the shared count and every channel row
 * re-syncs at once — the core promise of the product, shown not told.
 *
 * Auto-play is off when the visitor prefers reduced motion; the
 * "Tạo đơn thử" button always works so the demo stays usable either way.
 */

const CHANNEL_ORDER: ChannelKey[] = ["pos", "website", "shopee", "lazada", "tiktok", "facebook"];
// Rough real-world mix: marketplaces drive most volume.
const CHANNEL_WEIGHTS: Record<ChannelKey, number> = { pos: 3, website: 1, shopee: 4, lazada: 2, tiktok: 4, facebook: 2 };
const START_STOCK = 24;
const LOW_STOCK = 5;
const RESTOCK_AT = 3;
const TICK_MS = 2800;

type DemoEvent =
  | { id: number; kind: "sale"; channel: ChannelKey; qty: number; code: string; time: string; syncMs: number }
  | { id: number; kind: "restock"; qty: number; time: string; syncMs: number };

function pickChannel(): ChannelKey {
  const total = CHANNEL_ORDER.reduce((s, c) => s + CHANNEL_WEIGHTS[c], 0);
  let r = Math.random() * total;
  for (const c of CHANNEL_ORDER) {
    r -= CHANNEL_WEIGHTS[c];
    if (r <= 0) return c;
  }
  return "pos";
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

const nowTime = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const SEED_EVENTS: DemoEvent[] = [
  { id: -1, kind: "sale", channel: "shopee", qty: 1, code: "DH-10479", time: "09:41:12", syncMs: 420 },
  { id: -2, kind: "sale", channel: "pos", qty: 2, code: "DH-10478", time: "09:40:55", syncMs: 310 },
];

export function SyncDemo() {
  const [stock, setStock] = useState(START_STOCK);
  const [events, setEvents] = useState<DemoEvent[]>(SEED_EVENTS);
  // Auto-play follows the reduced-motion preference until the visitor
  // presses the play/pause button themselves.
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => true);
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const playing = userChoice ?? !reducedMotion;
  const setPlaying = (fn: (p: boolean) => boolean) => setUserChoice(fn(playing));
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(1);
  const nextCode = useRef(10480);
  const stockRef = useRef(START_STOCK);

  const latest = events[0]?.id > 0 ? events[0] : null;

  const step = useCallback((manual = false) => {
    const id = nextId.current++;
    const syncMs = 250 + Math.round(Math.random() * 550);
    let ev: DemoEvent;

    if (stockRef.current <= RESTOCK_AT) {
      ev = { id, kind: "restock", qty: 20, time: nowTime(), syncMs };
      stockRef.current += 20;
    } else {
      const qty = Math.random() < 0.8 ? 1 : 2;
      ev = { id, kind: "sale", channel: pickChannel(), qty, code: `DH-${nextCode.current++}`, time: nowTime(), syncMs };
      stockRef.current -= qty;
    }

    setStock(stockRef.current);
    setEvents((prev) => [ev, ...prev].slice(0, 3));
    if (manual) {
      setAnnouncement(
        ev.kind === "sale"
          ? `Đơn ${ev.code} từ ${CHANNELS[ev.channel].label}. Tồn kho còn ${stockRef.current} trên mọi kênh.`
          : `Đã nhập thêm ${ev.qty} sản phẩm. Tồn kho mới ${stockRef.current}.`,
      );
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => step(), TICK_MS);
    return () => window.clearInterval(t);
  }, [playing, step]);

  const low = stock <= LOW_STOCK;

  return (
    <div className="relative rounded-3xl bg-card p-4 text-card-foreground shadow-[0_24px_48px_-28px_rgb(18_20_16/0.35)] sm:p-6">
      {/* Product */}
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-soft text-foreground">
          <Shirt className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">Áo linen cổ tàu</p>
          <p className="text-sm text-muted-foreground">Màu be, size M</p>
          <p className="mt-1 text-xs font-medium whitespace-nowrap text-muted-foreground tabular">SKU LN-CT-BE-M</p>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-pressed={!playing}
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          <span className="sr-only sm:not-sr-only">{playing ? "Tạm dừng" : "Tự chạy"}</span>
        </button>
      </div>

      {/* Shared stock */}
      <div className="mt-4 rounded-2xl bg-muted p-4">
        <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Tồn kho chung, chi nhánh Quận 1</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span key={stock} className="inline-block text-6xl leading-none font-light tracking-tight tabular animate-tick">
                {stock}
              </span>
              <span className="text-sm text-muted-foreground">sản phẩm có thể bán</span>
            </p>
          </div>
          {low && (
            <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber-ink">Sắp hết hàng</span>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out", low ? "bg-amber" : "bg-ink")}
            style={{ width: `${Math.min(100, (stock / 30) * 100)}%` }}
          />
        </div>
      </div>

      {/* Channels */}
      <ul className="mt-3 divide-y divide-border" aria-label="Tồn kho trên từng kênh bán">
        {CHANNEL_ORDER.map((key) => {
          const isSource = latest?.kind === "sale" && latest.channel === key;
          return (
            <li
              // Re-keying on each event restarts the one-shot flash animation.
              key={`${key}-${latest?.id ?? 0}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2",
                latest && (isSource ? "animate-flash-amber" : "animate-flash-lime"),
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHANNELS[key].color }} aria-hidden />
              <span className="flex-1 text-sm font-medium">{CHANNELS[key].label}</span>
              {isSource && latest?.kind === "sale" ? (
                <span className="text-xs font-semibold text-amber-ink">Đơn mới −{latest.qty}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3.5 text-success" aria-hidden />
                  Đã khớp
                </span>
              )}
              <span className="w-8 text-right text-sm font-semibold tabular">{stock}</span>
            </li>
          );
        })}
      </ul>

      {/* Feed */}
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold whitespace-nowrap">Hoạt động gần đây</p>
          <button
            type="button"
            onClick={() => step(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-lime px-4 whitespace-nowrap text-sm font-medium text-lime-foreground transition-colors hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden />
            Tạo đơn thử
          </button>
        </div>
        <ol className="mt-2 space-y-1">
          {events.map((ev) => (
            <li key={ev.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-md py-1 text-sm">
              {ev.kind === "sale" ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: CHANNELS[ev.channel].color }} aria-hidden />
                  <span className="font-medium tabular">{ev.code}</span>
                  <span className="truncate text-muted-foreground">
                    {CHANNELS[ev.channel].label}, {ev.qty} sp
                  </span>
                </span>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <Truck className="size-3.5 shrink-0 text-foreground" aria-hidden />
                  <span className="font-medium">Nhập kho +{ev.qty}</span>
                  <span className="truncate text-muted-foreground">tự động đẩy lên 6 kênh</span>
                </span>
              )}
              <span className="text-xs text-muted-foreground tabular">
                khớp sau {(ev.syncMs / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giây
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
