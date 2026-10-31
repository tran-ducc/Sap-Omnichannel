"use client";

import type { PosPaymentMethod, PosReceipt, PosShift, ShiftCloseReport } from "@omni/shared";
import { CheckCircle2, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/app/dialog";
import { FormField } from "@/components/app/form-field";
import { InlineError } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { PAYMENT_METHOD } from "@/lib/domain";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Receipt after a sale. The receipt block is what prints (see .print-area in globals.css). */
export function ReceiptDialog({ receipt, onClose }: { receipt: PosReceipt | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!receipt}
      onClose={onClose}
      title="Thanh toán thành công"
      footer={
        <>
          <button type="button" onClick={() => window.print()} className={buttonVariants({ variant: "outline", size: "md" })}>
            <Printer className="size-4" aria-hidden />
            In hoá đơn
          </button>
          <button type="button" autoFocus onClick={onClose} className={buttonVariants({ size: "md" })}>
            Đơn mới
          </button>
        </>
      }
    >
      {receipt && (
        <>
          {receipt.change !== null && receipt.change > 0 && (
            <p className="mb-4 flex items-center justify-between rounded-2xl bg-lime px-4 py-3 text-lime-foreground" role="status">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-5" aria-hidden />
                Thối lại khách
              </span>
              <span className="text-2xl font-light tabular">{formatVND(receipt.change)}</span>
            </p>
          )}
          <Receipt receipt={receipt} />
        </>
      )}
    </Dialog>
  );
}

function Receipt({ receipt: r }: { receipt: PosReceipt }) {
  return (
    <div className="print-area rounded-2xl border border-dashed border-foreground/25 p-4 text-sm">
      <p className="text-center text-base font-semibold">{r.shopName}</p>
      <p className="text-center text-xs text-muted-foreground">{r.locationName}</p>
      <p className="mt-3 flex justify-between text-xs">
        <span className="tabular">{r.code}</span>
        <span>{new Date(r.at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
      </p>
      <p className="text-xs text-muted-foreground">Thu ngân: {r.cashierName}</p>
      <table className="mt-3 w-full text-xs">
        <tbody>
          {r.items.map((i) => (
            <tr key={i.sku} className="align-top">
              <td className="py-1 pr-2">
                {i.name}
                <span className="block text-muted-foreground tabular">
                  {formatNumber(i.quantity)} x {formatNumber(i.unitPrice)}
                </span>
              </td>
              <td className="py-1 text-right tabular">{formatNumber(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-2 space-y-0.5 border-t border-dashed border-foreground/25 pt-2 text-xs">
        {r.discount > 0 && (
          <div className="flex justify-between">
            <dt>Giảm giá</dt>
            <dd className="tabular">−{formatNumber(r.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold">
          <dt>Tổng cộng</dt>
          <dd className="tabular">{formatVND(r.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{PAYMENT_METHOD[r.method]}</dt>
          <dd className="tabular">{formatNumber(r.received ?? r.total)}</dd>
        </div>
        {r.change !== null && (
          <div className="flex justify-between">
            <dt>Tiền thối</dt>
            <dd className="tabular">{formatNumber(r.change)}</dd>
          </div>
        )}
      </dl>
      {r.customer && (
        <p className="mt-2 border-t border-dashed border-foreground/25 pt-2 text-xs">
          Khách: {r.customer.fullName}
          <br />
          Điểm cộng thêm {formatNumber(r.customer.pointsEarned)}, tổng {formatNumber(r.customer.pointsTotal)} điểm
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">Cảm ơn quý khách, hẹn gặp lại!</p>
    </div>
  );
}

const METHOD_ORDER: PosPaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD"];

/** End of shift: count the drawer, see the difference, then the report. */
export function CloseShiftDialog({ open, shift, onClose, onClosed }: { open: boolean; shift: PosShift; onClose: () => void; onClosed: () => void }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ShiftCloseReport | null>(null);
  const countedNum = Number(counted || 0);
  const diff = counted ? countedNum - shift.expectedCash : null;

  async function submit() {
    setPending(true);
    setError("");
    try {
      setReport(await api<ShiftCloseReport>(`/pos/shifts/${shift.id}/close`, { method: "POST", json: { countedCash: countedNum, note: note.trim() || undefined } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const finish = () => {
    try {
      localStorage.removeItem(`pos-cart:${shift.id}`);
    } catch {
      /* storage unavailable */
    }
    onClosed();
  };

  if (report) {
    return (
      <Dialog open onClose={finish} title="Đã đóng ca" description={`${report.location}, ${new Date(report.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} đến ${new Date(report.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`} footer={<button type="button" autoFocus onClick={finish} className={buttonVariants({ size: "md" })}>Xong</button>}>
        <dl className="space-y-2 text-sm">
          <Line label="Số đơn" value={formatNumber(report.orders)} />
          <Line label="Doanh thu" value={formatVND(report.revenue)} strong />
          {METHOD_ORDER.map((m) => (report.byMethod[m] ? <Line key={m} label={PAYMENT_METHOD[m]} value={formatVND(report.byMethod[m]!)} /> : null))}
          <div className="border-t border-border pt-2" />
          <Line label="Tiền đầu ca" value={formatVND(report.openingCash)} />
          <Line label="Tiền mặt phải có" value={formatVND(report.expectedCash)} />
          <Line label="Tiền mặt đếm được" value={formatVND(report.countedCash)} />
          <div className={cn("flex justify-between rounded-2xl px-3 py-2", report.difference === 0 ? "bg-lime-soft" : "bg-amber-soft text-amber-ink")}>
            <dt>{report.difference === 0 ? "Khớp" : report.difference > 0 ? "Thừa" : "Thiếu"}</dt>
            <dd className="font-medium tabular">{formatVND(Math.abs(report.difference))}</dd>
          </div>
        </dl>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Đóng ca"
      description="Đếm tiền mặt trong két rồi nhập số tiền thực tế."
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "md" })}>
            Bán tiếp
          </button>
          <button type="button" disabled={pending || counted === ""} onClick={submit} className={buttonVariants({ size: "md" })}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Đóng ca
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        <dl className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
          <Line label="Số đơn trong ca" value={formatNumber(shift.orders)} />
          <Line label="Doanh thu" value={formatVND(shift.revenue)} strong />
          {METHOD_ORDER.map((m) => (shift.byMethod[m] ? <Line key={m} label={PAYMENT_METHOD[m]} value={formatVND(shift.byMethod[m]!)} /> : null))}
          <Line label="Tiền mặt phải có trong két" value={formatVND(shift.expectedCash)} strong />
        </dl>
        <FormField label="Tiền mặt đếm được" required inputMode="numeric" value={counted ? formatNumber(countedNum) : ""} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} />
        {diff !== null && (
          <p className={cn("rounded-2xl px-4 py-3 text-sm", diff === 0 ? "bg-lime-soft" : "bg-amber-soft text-amber-ink")} aria-live="polite">
            {diff === 0 ? "Khớp với số tiền phải có." : `${diff > 0 ? "Thừa" : "Thiếu"} ${formatVND(Math.abs(diff))} so với số tiền phải có.`}
          </p>
        )}
        {diff !== null && diff !== 0 && <FormField label="Ghi chú chênh lệch" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: thối nhầm cho khách" maxLength={300} />}
      </div>
    </Dialog>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular", strong && "font-medium")}>{value}</dd>
    </div>
  );
}
