"use client";

import type { InventoryMovementType, LocationSummary, MovementItem, StockLevel } from "@omni/shared";
import { ArrowRight, History, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, ApiRequestError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Segmented, SelectField } from "./controls";
import { Dialog } from "./dialog";
import { FormField } from "./form-field";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "./states";

export interface StockTarget {
  variantId: string;
  label: string;
  sku: string;
  levels: StockLevel[];
}

type Mode = "add" | "remove" | "set";
const REASONS: Record<Mode, { value: string; label: string }[]> = {
  add: [
    { value: "PURCHASE", label: "Nhập hàng từ nhà cung cấp" },
    { value: "RETURN", label: "Khách trả hàng" },
    { value: "OTHER", label: "Lý do khác" },
  ],
  remove: [
    { value: "DAMAGE", label: "Hàng hỏng, mất" },
    { value: "OTHER", label: "Lý do khác" },
  ],
  set: [{ value: "COUNT", label: "Kiểm kho định kỳ" }],
};

const levelAt = (levels: StockLevel[], locationId: string) => levels.find((l) => l.locationId === locationId);

export function AdjustStockDialog({
  target,
  locations,
  defaultLocationId,
  onClose,
  onDone,
}: {
  target: StockTarget | null;
  locations: LocationSummary[];
  defaultLocationId?: string;
  onClose: () => void;
  onDone: (variantId: string, level: StockLevel) => void;
}) {
  return (
    <Dialog open={!!target} onClose={onClose} title="Điều chỉnh tồn kho" description={target ? `${target.label}, SKU ${target.sku}` : undefined}>
      {target && <AdjustForm key={target.variantId} target={target} locations={locations} defaultLocationId={defaultLocationId} onClose={onClose} onDone={onDone} />}
    </Dialog>
  );
}

function AdjustForm({ target, locations, defaultLocationId, onClose, onDone }: { target: StockTarget; locations: LocationSummary[]; defaultLocationId?: string; onClose: () => void; onDone: (variantId: string, level: StockLevel) => void }) {
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("add");
  const [reason, setReason] = useState("PURCHASE");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);

  const current = levelAt(target.levels, locationId);
  const onHand = current?.onHand ?? 0;
  const n = Number(qty);
  const valid = qty !== "" && Number.isInteger(n) && n >= 0;
  const after = !valid ? null : mode === "add" ? onHand + n : mode === "remove" ? onHand - n : n;

  function changeMode(m: Mode) {
    setMode(m);
    setReason(REASONS[m][0].value);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api<{ changed: boolean; level?: StockLevel }>("/inventory/adjust", {
        method: "POST",
        json: { variantId: target.variantId, locationId, mode, quantity: n, reason, note: note.trim() || undefined },
      });
      if (res.level) onDone(target.variantId, res.level);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && <InlineError message={error.message} />}
      <SelectField label="Chi nhánh / kho" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} (đang có {formatNumber(levelAt(target.levels, l.id)?.onHand ?? 0)})
          </option>
        ))}
      </SelectField>
      <div>
        <p className="mb-1.5 text-sm font-medium">Cách điều chỉnh</p>
        <Segmented
          label="Cách điều chỉnh"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "add", label: "Nhập thêm" },
            { value: "remove", label: "Xuất bớt" },
            { value: "set", label: "Kiểm kê" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={mode === "set" ? "Số lượng thực tế đếm được" : "Số lượng"}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          error={error?.field("quantity")}
        />
        <SelectField label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS[mode].map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
      </div>
      <FormField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Phiếu nhập NCC Hoà Bình số 128" maxLength={300} />

      <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm" aria-live="polite">
        <span className="text-muted-foreground">Tồn sau điều chỉnh</span>
        <span className="flex items-center gap-2 font-medium tabular">
          {formatNumber(onHand)}
          <ArrowRight className="size-3.5" aria-hidden />
          <span className={cn(after !== null && after < (current?.reserved ?? 0) && "text-destructive")}>{after === null ? "—" : formatNumber(after)}</span>
        </span>
      </div>
      {current && current.reserved > 0 && <p className="-mt-3 px-1 text-xs text-muted-foreground">{formatNumber(current.reserved)} sản phẩm đang được giữ cho đơn chưa giao.</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending || !valid || (mode !== "set" && n === 0)} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Lưu điều chỉnh
        </button>
      </div>
    </form>
  );
}

export function TransferStockDialog({
  target,
  locations,
  onClose,
  onDone,
}: {
  target: StockTarget | null;
  locations: LocationSummary[];
  onClose: () => void;
  onDone: (variantId: string, levels: StockLevel[]) => void;
}) {
  return (
    <Dialog open={!!target} onClose={onClose} title="Chuyển kho" description={target ? `${target.label}, SKU ${target.sku}` : undefined}>
      {target && <TransferForm key={target.variantId} target={target} locations={locations} onClose={onClose} onDone={onDone} />}
    </Dialog>
  );
}

function TransferForm({ target, locations, onClose, onDone }: { target: StockTarget; locations: LocationSummary[]; onClose: () => void; onDone: (variantId: string, levels: StockLevel[]) => void }) {
  // Default: from the location holding the most stock to the first other one.
  const richest = [...target.levels].sort((a, b) => b.available - a.available)[0]?.locationId ?? locations[0]?.id ?? "";
  const [from, setFrom] = useState(richest);
  const [to, setTo] = useState(locations.find((l) => l.id !== richest)?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);

  const available = levelAt(target.levels, from)?.available ?? 0;
  const n = Number(qty);
  const valid = Number.isInteger(n) && n >= 1 && n <= available && from !== to;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api<{ from: StockLevel; to: StockLevel }>("/inventory/transfer", {
        method: "POST",
        json: { variantId: target.variantId, fromLocationId: from, toLocationId: to, quantity: n, note: note.trim() || undefined },
      });
      onDone(target.variantId, [res.from, res.to]);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && <InlineError message={error.message} />}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <SelectField label="Từ" value={from} onChange={(e) => setFrom(e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({formatNumber(levelAt(target.levels, l.id)?.available ?? 0)})
            </option>
          ))}
        </SelectField>
        <ArrowRight className="mx-auto mb-3.5 hidden size-4 text-muted-foreground sm:block" aria-hidden />
        <SelectField label="Đến" value={to} onChange={(e) => setTo(e.target.value)} error={from === to ? "Chọn kho khác kho chuyển đi" : undefined}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      </div>
      <FormField
        label="Số lượng chuyển"
        type="number"
        inputMode="numeric"
        min={1}
        max={available}
        required
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        hint={`Có thể chuyển tối đa ${formatNumber(available)} sản phẩm.`}
        error={qty !== "" && n > available ? `Kho chuyển đi chỉ còn ${formatNumber(available)} sản phẩm` : error?.field("quantity")}
      />
      <FormField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Bổ sung hàng cho cuối tuần" maxLength={300} />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending || !valid} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Chuyển kho
        </button>
      </div>
    </form>
  );
}

const MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  PURCHASE: "Nhập hàng",
  SALE: "Bán hàng",
  RETURN: "Khách trả",
  ADJUSTMENT: "Điều chỉnh",
  TRANSFER_IN: "Nhận chuyển kho",
  TRANSFER_OUT: "Chuyển kho đi",
  RESERVE: "Giữ hàng",
  RELEASE: "Nhả hàng giữ",
};

export function MovementHistoryDialog({ target, onClose }: { target: StockTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onClose={onClose} variant="side" title="Lịch sử tồn kho" description={target ? `${target.label}, SKU ${target.sku}` : undefined}>
      {target && <MovementList variantId={target.variantId} />}
    </Dialog>
  );
}

function MovementList({ variantId }: { variantId: string }) {
  const { data, error, reload } = useApiQuery<MovementItem[]>(`/inventory/${variantId}/movements`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RowsSkeleton rows={5} />;
  if (!data.length) return <EmptyState icon={History} title="Chưa có biến động" body="Mọi lần nhập, xuất, chuyển và bán sẽ được ghi lại ở đây." />;
  return (
    <ol className="space-y-2">
      {data.map((m) => (
        <li key={m.id} className="rounded-2xl bg-muted/70 p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{MOVEMENT_LABEL[m.type]}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-medium tabular", m.quantity > 0 ? "bg-lime text-lime-foreground" : "bg-card")}>
              {m.quantity > 0 ? "+" : "−"}
              {formatNumber(Math.abs(m.quantity))}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.locationName}
            {m.referenceCode && `, đơn ${m.referenceCode}`}
          </p>
          {m.note && <p className="mt-1 text-sm">{m.note}</p>}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {new Date(m.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
            {m.actorName && `, ${m.actorName}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
