"use client";

import type { CategorySummary, CustomerLite, InventoryChangedEvent, PosProduct, PosReceipt, PosShift } from "@omni/shared";
import { Banknote, CreditCard, Loader2, Lock, Minus, PackageSearch, Plus, QrCode, ScanLine, ShoppingBag, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, InlineError } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CloseShiftDialog, ReceiptDialog } from "./pos-dialogs";
import { usePosCart } from "./use-pos-cart";

const digits = (s: string) => s.replace(/\D/g, "");
const METHODS = [
  { value: "CASH", label: "Tiền mặt", icon: Banknote },
  { value: "BANK_TRANSFER", label: "Chuyển khoản", icon: QrCode },
  { value: "CARD", label: "Thẻ", icon: CreditCard },
] as const;

/** Banknote suggestions: exact amount, then the next round amounts a customer typically hands over. */
function cashSuggestions(total: number) {
  const out = new Set<number>([total]);
  for (const step of [50_000, 100_000, 200_000, 500_000]) out.add(Math.ceil(total / step) * step);
  return [...out].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 4);
}

export function Register({ shift, onShiftChange, onShiftClosed }: { shift: PosShift; onShiftChange: (s: PosShift) => void; onShiftClosed: () => void }) {
  const { can } = useSession();
  const { cart, add, setQty, setAvailable, patch, reset } = usePosCart(shift.id);
  const searchRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);

  // ---- product browsing ----------------------------------------------------
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const [categoryId, setCategoryId] = useState("");
  const { data: categories = [] } = useApiQuery<CategorySummary[]>("/categories");
  const productPath = `/pos/products?${new URLSearchParams({ sessionId: shift.id, ...(dq && { q: dq }), ...(categoryId && { categoryId }) })}`;
  const { data: products, loading: productsLoading, mutate: mutateProducts } = useApiQuery<PosProduct[]>(productPath);

  // Stock sold on other channels updates the grid and the cart live.
  useRealtime<InventoryChangedEvent>("inventory.changed", (e) => {
    if (e.level.locationId !== shift.location.id) return;
    mutateProducts((list) => list.map((p) => (p.variantId === e.variantId ? { ...p, available: e.level.available } : p)));
    setAvailable(e.variantId, e.level.available);
  });

  /** Scanner input: exact barcode/SKU (or a single result) goes straight into the cart. */
  async function onSearchEnter() {
    const value = q.trim();
    if (!value) return;
    const hits = await api<PosProduct[]>(`/pos/products?${new URLSearchParams({ sessionId: shift.id, q: value })}`).catch(() => []);
    const exact = hits.find((p) => p.barcode === value || p.sku.toLowerCase() === value.toLowerCase()) ?? (hits.length === 1 ? hits[0] : undefined);
    if (exact) {
      add(exact);
      setQ("");
    }
  }

  // ---- customer --------------------------------------------------------------
  const phone = digits(cart.phone);
  const { data: phoneHits } = useApiQuery<CustomerLite[]>(phone.length >= 9 ? `/customers/lookup?q=${phone}` : null);
  const customer = phoneHits?.find((c) => c.phone === phone) ?? null;
  const isNewCustomer = phone.length >= 10 && phoneHits !== undefined && !customer;

  // ---- totals ----------------------------------------------------------------
  const subtotal = cart.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = Math.min(Number(digits(cart.discount) || 0), subtotal);
  const total = subtotal - discount;
  const received = Number(digits(cart.received) || 0);
  const change = cart.method === "CASH" && received ? received - total : null;
  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0);
  const customerOk = !cart.phone || !!customer || (isNewCustomer && cart.newCustomerName.trim().length >= 2);
  const canPay = cart.lines.length > 0 && (cart.method !== "CASH" || !cart.received || received >= total) && customerOk;

  // ---- checkout --------------------------------------------------------------
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const [closing, setClosing] = useState(false);

  async function pay() {
    if (!canPay || paying) return;
    setPaying(true);
    setPayError("");
    try {
      const r = await api<PosReceipt>("/pos/checkout", {
        method: "POST",
        json: {
          sessionId: shift.id,
          clientRef: cart.clientRef,
          items: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          ...(customer ? { customerId: customer.id } : isNewCustomer ? { customer: { fullName: cart.newCustomerName.trim(), phone } } : {}),
          ...(discount > 0 && { discount }),
          method: cart.method,
          ...(cart.method === "CASH" && { received: received || total }),
        },
      });
      setReceipt(r);
      reset();
      api<PosShift>("/pos/shifts/current").then((s) => s && onShiftChange(s)).catch(() => undefined);
    } catch (e) {
      setPayError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  // Keyboard: F2 search, F9 pay (cashiers with a keyboard or barcode gun).
  const payRef = useRef(pay);
  useEffect(() => {
    payRef.current = pay;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        payRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inCart = (variantId: string) => cart.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;

  return (
    <div className="grid gap-3 pb-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---------------- Products ---------------- */}
      <section aria-label="Chọn sản phẩm" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-night px-4 py-3 text-sm text-night-foreground">
          <span className="font-medium">{shift.location.name}</span>
          <span className="opacity-60">Ca mở lúc {new Date(shift.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="rounded-full bg-night-foreground/10 px-2.5 py-0.5 tabular">{formatNumber(shift.orders)} đơn</span>
          <span className="rounded-full bg-lime px-2.5 py-0.5 font-medium text-lime-foreground tabular">{formatVND(shift.revenue)}</span>
          <button type="button" onClick={() => setClosing(true)} className="ml-auto h-9 cursor-pointer rounded-full bg-night-foreground/10 px-4 hover:bg-night-foreground/20">
            Đóng ca
          </button>
        </div>

        <div className="space-y-3 rounded-3xl bg-card p-3">
          <div className="relative">
            <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              autoFocus
              type="search"
              aria-label="Quét mã vạch hoặc tìm sản phẩm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSearchEnter())}
              placeholder="Quét mã vạch hoặc tìm sản phẩm (F2)"
              className="h-14 w-full rounded-full bg-muted pr-4 pl-12 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
          <div className="relative -mx-1 overflow-x-auto px-1">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Danh mục">
              {[{ id: "", name: "Tất cả" }, ...categories].map((c) => (
                <button
                  key={c.id || "all"}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={cn("h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm whitespace-nowrap", categoryId === c.id ? "bg-night text-night-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!products ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Đang tải sản phẩm">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-3xl bg-card/70" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Không có sản phẩm phù hợp" body={dq ? `Không tìm thấy “${dq}”.` : "Danh mục này chưa có sản phẩm."} className="bg-card" />
        ) : (
          <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4", productsLoading && "opacity-70")}>
            {products.map((p) => {
              const n = inCart(p.variantId);
              const out = p.available <= 0;
              const full = n >= p.available;
              return (
                <li key={p.variantId}>
                  <button
                    type="button"
                    disabled={out || full}
                    onClick={() => add(p)}
                    aria-label={`Thêm ${p.productName}, ${p.variantName}, ${formatVND(p.price)}${n ? `, đang có ${n} trong giỏ` : ""}`}
                    className={cn(
                      "relative flex h-full min-h-36 w-full cursor-pointer flex-col rounded-3xl p-4 text-left transition-[background-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                      n ? "bg-lime text-lime-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {n > 0 && <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-lime-foreground text-sm font-medium text-lime tabular">{n}</span>}
                    <span className="line-clamp-2 pr-8 text-sm font-medium">{p.productName}</span>
                    <span className="text-xs opacity-70">{p.variantName}</span>
                    <span className="mt-auto pt-3 text-lg tabular">{formatVND(p.price)}</span>
                    <span className={cn("text-xs tabular", out ? "font-medium text-destructive" : p.available <= 5 ? "font-medium text-amber-ink" : "opacity-60")}>
                      {out ? "Hết hàng" : `còn ${formatNumber(p.available)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------------- Cart ---------------- */}
      <aside ref={cartRef} id="pos-cart" aria-label="Giỏ hàng" className="flex flex-col rounded-3xl bg-card p-4 sm:p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-normal tracking-[-0.02em]">Giỏ hàng</h2>
          {cart.lines.length > 0 && (
            <button type="button" onClick={reset} className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">
              Xoá giỏ
            </button>
          )}
        </div>

        {/* keep at least ~2 lines visible on short tablet screens; the panel scrolls beyond that */}
        <div className="mt-3 min-h-40 flex-1 overflow-y-auto">
          {cart.lines.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-muted/60 px-4 py-10 text-center text-sm text-muted-foreground">
              <ShoppingBag className="mb-2 size-6" aria-hidden />
              Chạm vào sản phẩm hoặc quét mã vạch để thêm.
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.lines.map((l) => (
                <li key={l.variantId} className="rounded-2xl bg-muted/70 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.variantName}, {formatVND(l.price)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular">{formatVND(l.price * l.quantity)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-full bg-card p-1">
                      <button type="button" onClick={() => setQty(l.variantId, l.quantity - 1)} aria-label={`Bớt một ${l.productName}, ${l.variantName}`} className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-muted">
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <span className="w-8 text-center text-sm font-medium tabular" aria-label={`Số lượng ${l.quantity}`}>
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(l.variantId, l.quantity + 1)}
                        disabled={l.quantity >= l.available}
                        aria-label={`Thêm một ${l.productName}, ${l.variantName}`}
                        className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    {l.quantity >= l.available && <span className="text-xs text-amber-ink">Hết hàng tại quầy</span>}
                    <button type="button" onClick={() => setQty(l.variantId, 0)} aria-label={`Xoá ${l.productName}, ${l.variantName} khỏi giỏ`} className="flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {/* Customer */}
          <div>
            <FormField
              label="Số điện thoại khách (để tích điểm)"
              type="tel"
              inputMode="tel"
              value={cart.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="Bỏ trống nếu khách lẻ"
            />
            {customer && (
              <p className="mt-1.5 flex items-center gap-1.5 px-1 text-sm">
                <UserRound className="size-4" aria-hidden />
                {customer.fullName}, {customer.orderCount} lần mua
              </p>
            )}
            {isNewCustomer && (
              <FormField label="Tên khách mới" required value={cart.newCustomerName} onChange={(e) => patch({ newCustomerName: e.target.value })} className="mt-2" />
            )}
          </div>

          {can("pos:discount") ? (
            <FormField label="Giảm giá" inputMode="numeric" value={cart.discount ? formatNumber(Number(digits(cart.discount))) : ""} onChange={(e) => patch({ discount: digits(e.target.value) })} placeholder="0" />
          ) : (
            <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              Giảm giá cần quyền Quản lý
            </p>
          )}

          {/* Payment method */}
          <div role="radiogroup" aria-label="Cách thanh toán" className="grid grid-cols-3 gap-1.5 rounded-full bg-muted p-1.5">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cart.method === value}
                onClick={() => patch({ method: value })}
                className={cn("flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap sm:text-sm", cart.method === value ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {/* icons only where the cart is wide enough to keep labels on one line */}
                <Icon className="hidden size-4 xl:block" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {cart.method === "CASH" && cart.lines.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {cashSuggestions(total).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => patch({ received: String(v) })}
                    className={cn("h-10 cursor-pointer rounded-full px-3 text-sm tabular", received === v ? "bg-lime text-lime-foreground" : "bg-muted hover:bg-border")}
                  >
                    {v === total ? "Đủ tiền" : formatNumber(v)}
                  </button>
                ))}
              </div>
              <FormField label="Khách đưa" inputMode="numeric" value={cart.received ? formatNumber(received) : ""} onChange={(e) => patch({ received: digits(e.target.value) })} placeholder={formatNumber(total)} className="mt-2" />
            </div>
          )}

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính ({formatNumber(itemCount)} món)</dt>
              <dd className="tabular">{formatVND(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Giảm giá</dt>
                <dd className="tabular">−{formatVND(discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">Khách cần trả</dt>
              <dd className="text-3xl font-light tracking-tight tabular">{formatVND(total)}</dd>
            </div>
            {change !== null && (
              <div className={cn("flex justify-between rounded-2xl px-3 py-2", change >= 0 ? "bg-lime-soft" : "bg-destructive/10 text-destructive")} aria-live="polite">
                <dt>{change >= 0 ? "Tiền thối lại" : "Còn thiếu"}</dt>
                <dd className="font-medium tabular">{formatVND(Math.abs(change))}</dd>
              </div>
            )}
          </dl>

          {payError && <InlineError message={payError} />}
          <button type="button" onClick={pay} disabled={!canPay || paying} className={cn(buttonVariants({ size: "xl" }), "h-14 w-full text-base")}>
            {paying && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Thanh toán {cart.lines.length > 0 && formatVND(total)}
            <span className="hidden text-xs opacity-60 sm:inline">F9</span>
          </button>
        </div>
      </aside>

      {/* Phone/tablet portrait: jump to the cart */}
      {cart.lines.length > 0 && (
        <button
          type="button"
          onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed inset-x-3 bottom-3 z-30 flex h-14 cursor-pointer items-center justify-between rounded-full bg-night px-5 text-night-foreground shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm">
            <ShoppingBag className="size-4" aria-hidden />
            {formatNumber(itemCount)} món
          </span>
          <span className="font-medium tabular">{formatVND(total)}</span>
        </button>
      )}

      <ReceiptDialog
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          searchRef.current?.focus();
        }}
      />
      <CloseShiftDialog open={closing} shift={shift} onClose={() => setClosing(false)} onClosed={onShiftClosed} />
    </div>
  );
}
