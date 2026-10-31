"use client";

import type { Assignee, CustomerLite, InventoryList, LocationSummary, OrderDetail } from "@omni/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Segmented, SelectField } from "@/components/app/controls";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { api, ApiRequestError } from "@/lib/api";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

type Channel = "FACEBOOK" | "WEBSITE";
interface Line {
  variantId: string;
  label: string;
  sku: string;
  price: number;
  available: number;
  quantity: number;
}
const digits = (s: string) => s.replace(/\D/g, "");

export function OrderForm() {
  const router = useRouter();
  const { can, session } = useSession();
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");
  const { data: assignees = [] } = useApiQuery<Assignee[]>("/staff/assignees");

  const [channel, setChannel] = useState<Channel>("FACEBOOK");
  const [locationOverride, setLocationOverride] = useState("");
  // Online orders ship from the warehouse by default.
  const locationId = locationOverride || locations.find((l) => l.type === "WAREHOUSE")?.id || locations[0]?.id || "";

  // Customer: pick existing or enter new
  const [customerQ, setCustomerQ] = useState("");
  const cq = useDebounced(customerQ.trim(), 250);
  const { data: customerHits } = useApiQuery<CustomerLite[]>(cq.length >= 2 ? `/customers/lookup?q=${encodeURIComponent(cq)}` : null);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ fullName: string; phone: string } | null>(null);
  const [address, setAddress] = useState("");

  // Products
  const [productQ, setProductQ] = useState("");
  const pq = useDebounced(productQ.trim(), 250);
  const { data: productHits } = useApiQuery<InventoryList>(pq.length >= 2 && locationId ? `/inventory?q=${encodeURIComponent(pq)}&locationId=${locationId}&limit=8` : null);
  const [lines, setLines] = useState<Line[]>([]);

  const [shippingFee, setShippingFee] = useState("25000");
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [assignedToId, setAssignedToId] = useState(session?.role === "STAFF" ? session.user.id : "");
  const [paid, setPaid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  if (!can("order:create")) {
    return <EmptyState icon={Lock} title="Bạn chưa có quyền tạo đơn" className="bg-card" />;
  }

  const addLine = (r: InventoryList["items"][number], price: number) => {
    const available = r.levels[0]?.available ?? 0;
    setLines((ls) => (ls.some((l) => l.variantId === r.variantId) ? ls.map((l) => (l.variantId === r.variantId ? { ...l, quantity: Math.min(l.quantity + 1, available) } : l)) : [...ls, { variantId: r.variantId, label: `${r.productName}, ${r.variantName}`, sku: r.sku, price, available, quantity: 1 }]));
    setProductQ("");
  };
  const setQty = (variantId: string, q: number) => setLines((ls) => ls.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(q, l.available)) } : l)));

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const disc = Math.min(Number(digits(discount) || 0), subtotal);
  const ship = Number(digits(shippingFee) || 0);
  const total = subtotal - disc + ship;
  const hasCustomer = !!customer || (!!newCustomer && newCustomer.fullName.trim().length >= 2);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const order = await api<OrderDetail>("/orders", {
        method: "POST",
        json: {
          channelType: channel,
          ...(customer ? { customerId: customer.id } : newCustomer ? { customer: { fullName: newCustomer.fullName.trim(), phone: newCustomer.phone.trim() || undefined } } : {}),
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          shippingFee: ship,
          ...(disc > 0 && { discountTotal: disc }),
          note: note.trim() || undefined,
          locationId,
          assignedToId: assignedToId || undefined,
          shippingAddress: address.trim() ? { name: customer?.fullName ?? newCustomer?.fullName, phone: customer?.phone ?? newCustomer?.phone, address: address.trim() } : undefined,
          paid,
        },
      });
      router.replace(`/app/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  const pick = (r: InventoryList["items"][number]) => addLine(r, r.price);

  return (
    <form onSubmit={submit} noValidate className="space-y-3 pb-28">
      <Link href="/app/orders" className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả đơn hàng
      </Link>
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-3xl bg-destructive/10 px-5 py-4 text-sm text-destructive outline-none">
          <p className="font-medium">{error.message}</p>
          {error.body.details && error.body.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.body.details.map((d, i) => (
                <li key={i}>{d.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">
          {/* Channel & location */}
          <section aria-labelledby="src-h" className="flex flex-col gap-4 rounded-3xl bg-card p-5 sm:flex-row sm:items-end sm:p-6">
            <div className="flex-1">
              <h2 id="src-h" className="mb-2 text-sm font-medium">
                Đơn chốt qua
              </h2>
              <Segmented
                label="Kênh bán"
                value={channel}
                onChange={setChannel}
                options={[
                  { value: "FACEBOOK", label: "Facebook, inbox" },
                  { value: "WEBSITE", label: "Website, điện thoại" },
                ]}
              />
            </div>
            <SelectField label="Xuất hàng từ" value={locationId} onChange={(e) => setLocationOverride(e.target.value)} className="sm:w-60">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          </section>

          {/* Products */}
          <section aria-labelledby="prod-h" className="rounded-3xl bg-card p-5 sm:p-6">
            <h2 id="prod-h" className="text-xl font-normal tracking-[-0.02em]">
              Sản phẩm
            </h2>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                aria-label="Tìm sản phẩm để thêm vào đơn"
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="Tìm tên hoặc SKU để thêm"
                className="h-12 w-full rounded-full bg-muted pr-4 pl-11 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              {pq.length >= 2 && productHits && (
                <ul className="absolute inset-x-0 top-14 z-20 max-h-80 overflow-y-auto rounded-3xl bg-card p-2 shadow-[0_24px_48px_-20px_rgb(18_20_16/0.35)]" role="listbox" aria-label="Kết quả sản phẩm">
                  {productHits.items.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Không tìm thấy sản phẩm</li>}
                  {productHits.items.map((r) => {
                    const available = r.levels[0]?.available ?? 0;
                    return (
                      <li key={r.variantId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          disabled={available <= 0}
                          onClick={() => pick(r)}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-2.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.productName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {r.variantName}, {r.sku}
                            </span>
                          </span>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs tabular", available > 0 ? "bg-muted" : "bg-destructive/10 text-destructive")}>
                            {available > 0 ? `còn ${formatNumber(available)}` : "Hết hàng"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">Tìm và chọn sản phẩm để thêm vào đơn.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {lines.map((l) => (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/70 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.label}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        {l.sku}, {formatVND(l.price)}, còn {formatNumber(l.available)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-card p-1">
                      <button type="button" onClick={() => setQty(l.variantId, l.quantity - 1)} aria-label={`Giảm số lượng ${l.label}`} className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-muted">
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <input
                        aria-label={`Số lượng ${l.label}`}
                        inputMode="numeric"
                        value={l.quantity}
                        onChange={(e) => setQty(l.variantId, Number(digits(e.target.value) || 1))}
                        className="w-10 bg-transparent text-center text-sm font-medium tabular outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(l.variantId, l.quantity + 1)}
                        disabled={l.quantity >= l.available}
                        aria-label={`Tăng số lượng ${l.label}`}
                        className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    <span className="w-28 text-right font-medium tabular">{formatVND(l.price * l.quantity)}</span>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))} aria-label={`Xoá ${l.label}`} className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Customer */}
          <section aria-labelledby="cus-h" className="space-y-4 rounded-3xl bg-card p-5 sm:p-6">
            <h2 id="cus-h" className="text-xl font-normal tracking-[-0.02em]">
              Khách hàng
            </h2>
            {customer ? (
              <div className="flex items-center gap-3 rounded-2xl bg-lime-soft p-3">
                <div className="flex-1">
                  <p className="font-medium">{customer.fullName}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {customer.phone ?? "Chưa có SĐT"}, {customer.orderCount} đơn trước
                  </p>
                </div>
                <button type="button" onClick={() => setCustomer(null)} aria-label="Bỏ chọn khách" className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-card">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : newCustomer ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Tên khách" required value={newCustomer.fullName} onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })} error={error?.field("customer.fullName")} />
                <FormField label="Số điện thoại" type="tel" inputMode="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} error={error?.field("customer.phone")} />
                <button type="button" onClick={() => setNewCustomer(null)} className="text-left text-sm text-muted-foreground underline underline-offset-4 sm:col-span-2">
                  Chọn khách đã có
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  aria-label="Tìm khách hàng"
                  value={customerQ}
                  onChange={(e) => setCustomerQ(e.target.value)}
                  placeholder="Tìm theo tên hoặc số điện thoại"
                  className="h-12 w-full rounded-full bg-muted pr-4 pl-11 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                {cq.length >= 2 && customerHits && (
                  <ul className="mt-2 space-y-1">
                    {customerHits.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setCustomer(c)} className="flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm hover:bg-muted">
                          <span>{c.fullName}</span>
                          <span className="text-xs text-muted-foreground tabular">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setNewCustomer({ fullName: /\d/.test(customerQ) ? "" : customerQ, phone: /\d/.test(customerQ) ? customerQ : "" })}
                  className={cn(buttonVariants({ variant: "outline", size: "md" }), "mt-3")}
                >
                  <UserPlus className="size-4" aria-hidden />
                  Thêm khách mới
                </button>
              </div>
            )}
            <FormField label="Địa chỉ giao hàng" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường, quận, tỉnh" />
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-3 lg:col-span-4">
          <section aria-labelledby="sum-h" className="space-y-4 rounded-3xl bg-card p-5 sm:p-6 lg:sticky lg:top-4">
            <h2 id="sum-h" className="text-xl font-normal tracking-[-0.02em]">
              Thanh toán
            </h2>
            <FormField label="Phí giao hàng" inputMode="numeric" value={shippingFee ? formatNumber(Number(digits(shippingFee))) : ""} onChange={(e) => setShippingFee(digits(e.target.value))} />
            {can("pos:discount") ? (
              <FormField label="Giảm giá" inputMode="numeric" value={discount ? formatNumber(Number(digits(discount))) : ""} onChange={(e) => setDiscount(digits(e.target.value))} placeholder="0" />
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Giảm giá cần quyền Quản lý
              </p>
            )}
            <SelectField label="Người phụ trách" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">Chưa phân công</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </SelectField>
            <div>
              <label htmlFor="order-note" className="mb-1.5 block text-sm font-medium">
                Ghi chú
              </label>
              <textarea
                id="order-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                className="w-full rounded-3xl border border-input bg-card px-5 py-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4 accent-[var(--ink)]" />
              Khách đã chuyển khoản trước
            </label>
            <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tạm tính</dt>
                <dd className="tabular">{formatVND(subtotal)}</dd>
              </div>
              {disc > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Giảm giá</dt>
                  <dd className="tabular">−{formatVND(disc)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phí giao hàng</dt>
                <dd className="tabular">{formatVND(ship)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="font-medium">Tổng cộng</dt>
                <dd className="text-3xl font-light tracking-tight tabular">{formatVND(total)}</dd>
              </div>
            </dl>
            <button type="submit" disabled={pending || lines.length === 0 || !hasCustomer} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Tạo đơn và giữ hàng
            </button>
            {(lines.length === 0 || !hasCustomer) && <p className="text-center text-xs text-muted-foreground">{lines.length === 0 ? "Thêm ít nhất một sản phẩm." : "Chọn hoặc thêm khách hàng."}</p>}
          </section>
        </aside>
      </div>
    </form>
  );
}
