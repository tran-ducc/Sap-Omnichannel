"use client";

import type { Assignee, OrderDetail, OrderEvent, OrderStatus } from "@omni/shared";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, MapPin, PackageCheck, Phone, ReceiptText, User } from "lucide-react";
import { useState } from "react";
import { SelectField } from "@/components/app/controls";
import { Dialog } from "@/components/app/dialog";
import { ChannelTag, PaymentPill, StatusPill } from "@/components/app/order-bits";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { Sparkle } from "@/components/marketing/decor";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { ORDER_STATUS, PAYMENT_METHOD, TRANSITION_LABEL } from "@/lib/domain";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPING", "COMPLETED"];
const CANCEL_REASONS = ["Khách đổi ý", "Hết hàng", "Không liên lạc được khách", "Đặt trùng đơn", "Lý do khác"];

function timelineText(action: string, meta: Record<string, unknown> | null) {
  switch (action) {
    case "order.created":
      return meta?.source === "marketplace" ? "Đơn được sàn gửi về" : "Tạo đơn";
    case "order.status_changed":
      return `${ORDER_STATUS[meta?.to as OrderStatus]?.label ?? meta?.to}${meta?.reason ? `: ${meta.reason}` : ""}`;
    case "order.assigned":
      return meta?.to ? `Phân công cho ${meta.to}` : "Bỏ phân công";
    default:
      return action;
  }
}

export function OrderDetailView({ id }: { id: string }) {
  const { can } = useSession();
  const { data, error, reload, mutate } = useApiQuery<OrderDetail>(`/orders/${id}`);
  const { data: assignees } = useApiQuery<Assignee[]>(can("order:update") ? "/staff/assignees" : null);
  const [pending, setPending] = useState<OrderStatus | "assign" | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");

  useRealtime<OrderEvent>("order.updated", (e) => {
    if (e.orderId === id && !pending) reload();
  });

  if (error && !data) {
    return error.status === 404 ? (
      <EmptyState
        icon={ReceiptText}
        title="Không tìm thấy đơn hàng"
        body="Đơn không tồn tại, hoặc bạn chỉ được xem các đơn mình tạo hoặc được phân công."
        action={
          <Link href="/app/orders" className={buttonVariants({ size: "md" })}>
            Về danh sách đơn
          </Link>
        }
        className="bg-card"
      />
    ) : (
      <ErrorState message={error.message} onRetry={reload} />
    );
  }
  if (!data) return <RowsSkeleton rows={6} className="rounded-3xl bg-card p-4" />;

  async function transition(to: OrderStatus, why?: string) {
    setPending(to);
    setActionError("");
    try {
      const updated = await api<OrderDetail>(`/orders/${id}/status`, { method: "PATCH", json: { status: to, reason: why } });
      mutate(() => updated);
      setConfirm(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function assign(userId: string) {
    setPending("assign");
    setActionError("");
    try {
      const updated = await api<OrderDetail>(`/orders/${id}/assign`, { method: "PATCH", json: { userId: userId || null } });
      mutate(() => updated);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  const forward = data.allowedTransitions.filter((s) => s !== "CANCELLED" && s !== "RETURNED");
  const destructive = data.allowedTransitions.filter((s) => s === "CANCELLED" || s === "RETURNED");
  const stepIndex = FLOW.indexOf(data.status);
  const stopped = data.status === "CANCELLED" || data.status === "RETURNED";

  return (
    <div className="space-y-3">
      <Link href="/app/orders" className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả đơn hàng
      </Link>

      {/* Header */}
      <section className="rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <ChannelTag channel={data.channelType} className="rounded-full bg-card px-3 py-1 text-foreground" />
              {data.externalOrderId && <span className="opacity-70 tabular">Mã sàn {data.externalOrderId}</span>}
            </p>
            <h1 className="mt-3 text-4xl font-normal tracking-[-0.03em] tabular">{data.code}</h1>
            <p className="mt-1 text-sm opacity-75">
              {new Date(data.placedAt).toLocaleString("vi-VN", { dateStyle: "full", timeStyle: "short" })}
              {data.location && `, xuất từ ${data.location.name}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={data.status} className="bg-card text-sm text-foreground" />
            <PaymentPill status={data.paymentStatus} />
          </div>
        </div>

        {/* Progress */}
        {!stopped ? (
          <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Tiến trình đơn hàng">
            {FLOW.map((s, i) => (
              <li key={s} aria-current={i === stepIndex ? "step" : undefined}>
                <div className={cn("h-2 rounded-full", i <= stepIndex ? "bg-lime-foreground" : "bg-card/70")} />
                <p className={cn("mt-1.5 text-xs", i === stepIndex ? "font-medium" : "opacity-60")}>{ORDER_STATUS[s].label}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-2xl bg-card/70 px-4 py-3 text-sm text-foreground">
            {data.status === "CANCELLED" ? `Đơn đã huỷ${data.cancelReason ? `: ${data.cancelReason}` : ""}.` : "Khách đã trả hàng, hàng được nhập lại kho."}
          </p>
        )}

        {/* Actions */}
        {data.allowedTransitions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {forward.map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={!!pending}
                onClick={() => transition(s)}
                className={cn(buttonVariants({ size: "xl" }), i === 0 ? "bg-lime-foreground text-lime hover:bg-lime-foreground/85" : "bg-card text-foreground hover:bg-muted")}
              >
                {pending === s ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                {TRANSITION_LABEL[s]}
              </button>
            ))}
            {destructive.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!!pending}
                onClick={() => setConfirm(s)}
                className={cn(buttonVariants({ variant: "outline", size: "xl" }), "border-lime-foreground/25 bg-transparent text-lime-foreground hover:bg-card/40")}
              >
                {TRANSITION_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        {!can("order:update") && !stopped && data.status !== "COMPLETED" && (
          <p className="mt-4 text-sm opacity-75">Bạn xem được đơn này. Quản lý sẽ xác nhận và chuyển trạng thái.</p>
        )}
      </section>
      {actionError && <InlineError message={actionError} />}

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Items + totals */}
        <section aria-labelledby="items-h" className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 lg:col-span-8">
          <h2 id="items-h" className="text-xl font-normal tracking-[-0.02em]">
            Sản phẩm
          </h2>
          <ul className="mt-4 space-y-2">
            {data.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-sm font-medium tabular">{i.quantity}</span>
                <div className="min-w-0 flex-1">
                  {i.productId ? (
                    <Link href={`/app/products/${i.productId}`} className="font-medium hover:underline">
                      {i.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{i.name}</span>
                  )}
                  <p className="text-xs text-muted-foreground tabular">
                    {i.sku}, {formatVND(i.unitPrice)} x {i.quantity}
                  </p>
                </div>
                <span className="font-medium tabular">{formatVND(i.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <Row label="Tạm tính" value={formatVND(data.subtotal)} />
            {data.discountTotal > 0 && <Row label="Giảm giá" value={`−${formatVND(data.discountTotal)}`} />}
            <Row label="Phí giao hàng" value={data.shippingFee ? formatVND(data.shippingFee) : "Miễn phí"} />
            <div className="flex items-baseline justify-between pt-2">
              <dt className="font-medium">Tổng cộng</dt>
              <dd className="text-3xl font-light tracking-tight tabular">{formatVND(data.total)}</dd>
            </div>
          </dl>
          {data.note && <p className="mt-4 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">Ghi chú: {data.note}</p>}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <PackageCheck className="size-4" aria-hidden />
            {stockNote(data)}
          </p>
        </section>

        <div className="grid content-start gap-3 lg:col-span-4">
          {/* Customer */}
          <section aria-labelledby="cust-h" className="rounded-3xl bg-card p-5">
            <h2 id="cust-h" className="text-sm text-muted-foreground">
              Khách hàng
            </h2>
            {data.customer ? (
              <>
                <p className="mt-2 flex items-center gap-2 text-lg">
                  <User className="size-4" aria-hidden />
                  {data.customer.fullName}
                </p>
                {data.customer.phone && (
                  <a href={`tel:${data.customer.phone}`} className="mt-1 flex items-center gap-2 text-sm tabular hover:underline">
                    <Phone className="size-4" aria-hidden />
                    {data.customer.phone}
                  </a>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(data.customer.orderCount)} đơn đã mua, tổng {formatVND(data.customer.totalSpent)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm">Khách lẻ</p>
            )}
            {data.shippingAddress?.address && (
              <p className="mt-3 flex gap-2 border-t border-border pt-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {data.shippingAddress.name && <span className="block font-medium">{data.shippingAddress.name}</span>}
                  {data.shippingAddress.address}
                </span>
              </p>
            )}
          </section>

          {/* Assignment */}
          <section aria-labelledby="assign-h" className="rounded-3xl bg-card p-5">
            <h2 id="assign-h" className="text-sm text-muted-foreground">
              Người phụ trách
            </h2>
            {can("order:update") && assignees ? (
              <SelectField label="Phân công" hideLabel value={data.assignedTo?.id ?? ""} onChange={(e) => assign(e.target.value)} disabled={pending === "assign"} className="mt-2">
                <option value="">Chưa phân công</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName} ({a.role})
                  </option>
                ))}
              </SelectField>
            ) : (
              <p className="mt-2">{data.assignedTo?.fullName ?? "Chưa phân công"}</p>
            )}
            {data.createdBy && <p className="mt-3 text-xs text-muted-foreground">Tạo bởi {data.createdBy.fullName}</p>}
          </section>

          {/* Payments */}
          <section aria-labelledby="pay-h" className="rounded-3xl bg-card p-5">
            <h2 id="pay-h" className="text-sm text-muted-foreground">
              Thanh toán
            </h2>
            {data.payments.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>{PAYMENT_METHOD[p.method]}</span>
                    <span className="font-medium tabular">{formatVND(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">{data.status === "CANCELLED" ? "Đơn đã huỷ, không thu tiền." : "Chưa thu tiền. Đơn COD sẽ ghi nhận khi hoàn thành."}</p>
            )}
          </section>
        </div>

        {/* Timeline */}
        <section aria-labelledby="tl-h" className="rounded-3xl bg-night p-5 text-night-foreground sm:p-6 lg:col-span-12">
          <h2 id="tl-h" className="text-xl font-normal tracking-[-0.02em]">
            Lịch sử đơn
          </h2>
          <ol className="relative mt-4 space-y-4 pl-6">
            <span className="absolute top-1 bottom-1 left-[5px] w-px bg-night-foreground/25" aria-hidden />
            {data.timeline.map((t, i) => (
              <li key={t.id} className="relative">
                <Sparkle className={cn("absolute top-1 -left-6 size-3", i === data.timeline.length - 1 ? "fill-lime" : "fill-night-foreground/60")} />
                <p className="text-sm">{timelineText(t.action, t.metadata)}</p>
                <p className="text-xs opacity-60">
                  {new Date(t.at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                  {t.actorName && `, ${t.actorName}`}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Confirm cancel / return */}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "CANCELLED" ? `Huỷ đơn ${data.code}?` : `Ghi nhận khách trả đơn ${data.code}?`}
        description={
          confirm === "CANCELLED"
            ? data.stockReserved && !data.stockDeducted
              ? "Hàng đang giữ cho đơn sẽ được trả lại để bán tiếp."
              : "Đơn sẽ chuyển sang trạng thái đã huỷ."
            : "Sản phẩm sẽ được nhập lại kho xuất hàng. Đơn đã thanh toán sẽ chuyển sang đã hoàn tiền."
        }
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={buttonVariants({ variant: "outline", size: "md" })}>
              Quay lại
            </button>
            <button
              type="button"
              disabled={!!pending || (confirm === "CANCELLED" && reason === "Lý do khác" && !otherReason.trim())}
              onClick={() => confirm && transition(confirm, confirm === "CANCELLED" ? (reason === "Lý do khác" ? otherReason.trim() : reason) : undefined)}
              className={cn(buttonVariants({ size: "md" }), "bg-destructive text-white hover:bg-destructive/90")}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {confirm ? TRANSITION_LABEL[confirm] : ""}
            </button>
          </>
        }
      >
        {confirm === "CANCELLED" && (
          <div className="space-y-4">
            <SelectField label="Lý do huỷ" value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectField>
            {reason === "Lý do khác" && (
              <div>
                <label htmlFor="other-reason" className="mb-1.5 block text-sm font-medium">
                  Lý do cụ thể
                </label>
                <input
                  id="other-reason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  maxLength={300}
                  className="h-12 w-full rounded-full border border-input bg-card px-5 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** What happened to the stock for this order, in the order's current state. */
function stockNote(o: OrderDetail) {
  const units = formatNumber(o.items.reduce((s, i) => s + i.quantity, 0));
  if (o.status === "RETURNED") return `Khách trả hàng: ${units} sản phẩm đã nhập lại kho.`;
  if (o.status === "CANCELLED") return o.stockReserved && !o.stockDeducted ? `${units} sản phẩm giữ cho đơn đã được trả lại để bán tiếp.` : "Đơn đã huỷ.";
  if (o.stockDeducted) return `Đã xuất kho ${units} sản phẩm.`;
  if (o.stockReserved) return `Đang giữ ${units} sản phẩm tại kho cho đơn này.`;
  return "Đơn nhập trước khi theo dõi tồn kho, không giữ hàng.";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
