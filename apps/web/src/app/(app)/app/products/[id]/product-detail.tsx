"use client";

import type { CategorySummary, ChannelSyncedEvent, InventoryChangedEvent, LocationSummary, ProductDetail, StockLevel, VariantDetail } from "@omni/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, ArrowLeftRight, History, Loader2, PackageX, Pencil, SlidersHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/app/controls";
import { Dialog } from "@/components/app/dialog";
import { FormField } from "@/components/app/form-field";
import { PriceInput } from "@/components/app/price-input";
import { useSession } from "@/components/app/session-provider";
import { AdjustStockDialog, MovementHistoryDialog, TransferStockDialog, type StockTarget } from "@/components/app/stock-dialogs";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { SyncStatus } from "@/components/app/sync-status";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useRealtime } from "@/hooks/use-realtime";
import { api, ApiRequestError } from "@/lib/api";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { ACTIVE: "Đang bán", DRAFT: "Nháp", ARCHIVED: "Đã lưu trữ" } as const;

function patchLevels(levels: StockLevel[], next: StockLevel) {
  return levels.some((l) => l.locationId === next.locationId) ? levels.map((l) => (l.locationId === next.locationId ? next : l)) : [...levels, next];
}

export function ProductDetailView({ id }: { id: string }) {
  const { can, inScope } = useSession();
  const router = useRouter();
  const { data, error, reload, mutate } = useApiQuery<ProductDetail>(`/products/${id}`);
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");

  const [adjusting, setAdjusting] = useState<StockTarget | null>(null);
  const [transferring, setTransferring] = useState<StockTarget | null>(null);
  const [history, setHistory] = useState<StockTarget | null>(null);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const patchVariant = (variantId: string, fn: (v: VariantDetail) => VariantDetail) =>
    mutate((d) => ({ ...d, variants: d.variants.map((v) => (v.id === variantId ? fn(v) : v)) }));

  useRealtime<InventoryChangedEvent>("inventory.changed", (e) => inScope(e.level.locationId) && patchVariant(e.variantId, (v) => ({ ...v, levels: patchLevels(v.levels, e.level) })));
  useRealtime<ChannelSyncedEvent>("channel.synced", (e) => patchVariant(e.variantId, (v) => ({ ...v, listings: e.listings })));

  if (error && !data) {
    return error.status === 404 ? (
      <EmptyState
        icon={PackageX}
        title="Không tìm thấy sản phẩm"
        body="Sản phẩm có thể đã bị xoá hoặc thuộc cửa hàng khác."
        action={
          <Link href="/app/products" className={buttonVariants({ size: "md" })}>
            Về danh sách sản phẩm
          </Link>
        }
        className="bg-card"
      />
    ) : (
      <ErrorState message={error.message} onRetry={reload} />
    );
  }
  if (!data) return <RowsSkeleton rows={6} className="rounded-3xl bg-card p-4" />;

  const toTarget = (v: VariantDetail): StockTarget => ({ variantId: v.id, label: `${data.name}, ${v.name}`, sku: v.sku, levels: v.levels });
  const canPrice = can("product:update_price");
  const seeCost = data.variants.some((v) => "costPrice" in v);
  const totalOnHand = data.variants.reduce((s, v) => s + v.levels.reduce((a, l) => a + l.onHand, 0), 0);

  async function savePrice(variantId: string, body: { price?: number; costPrice?: number }) {
    const updated = await api<ProductDetail>(`/products/variants/${variantId}`, { method: "PATCH", json: body });
    mutate(() => updated);
  }

  return (
    <div className="space-y-3" style={{ ["--notch-bg" as string]: "var(--background)" }}>
      <Link href="/app/products" className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả sản phẩm
      </Link>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Header card */}
        <section className="relative rounded-3xl bg-lime p-5 text-lime-foreground sm:p-6 lg:col-span-7">
          {(can("product:update") || can("product:delete")) && data.status !== "ARCHIVED" && (
            <div className="notch flex gap-2">
              {can("product:update") && (
                <button type="button" onClick={() => setEditing(true)} aria-label="Sửa thông tin sản phẩm" className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-card text-foreground hover:bg-muted">
                  <Pencil className="size-5" aria-hidden />
                </button>
              )}
              {can("product:delete") && (
                <button type="button" onClick={() => setArchiving(true)} aria-label="Lưu trữ sản phẩm" className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-card text-foreground hover:bg-muted">
                  <Archive className="size-5" aria-hidden />
                </button>
              )}
            </div>
          )}
          <p className="pr-28 text-sm opacity-70">{data.category ?? "Chưa phân loại"}</p>
          <h1 className="mt-2 pr-28 text-3xl font-normal tracking-[-0.03em] sm:text-4xl">{data.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-card px-3 py-1 text-foreground">{STATUS_LABEL[data.status]}</span>
            {data.options.map((o) => (
              <span key={o.name} className="rounded-full border border-lime-foreground/20 px-3 py-1">
                {o.name}: {o.values.join(", ")}
              </span>
            ))}
          </div>
          {data.description && <p className="mt-4 max-w-prose text-sm leading-relaxed opacity-80">{data.description}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:col-span-5">
          <div className="flex flex-col rounded-3xl bg-card p-5">
            <span className="text-sm text-muted-foreground">Số mẫu</span>
            <span className="mt-auto pt-4 text-3xl font-light tabular">{data.variants.length}</span>
          </div>
          <div className="flex flex-col rounded-3xl bg-card p-5">
            <span className="text-sm text-muted-foreground">Tổng tồn kho</span>
            <span className="mt-auto pt-4 text-3xl font-light tabular">{formatNumber(totalOnHand)}</span>
          </div>
          <div className="col-span-2 flex flex-col rounded-3xl bg-night p-5 text-night-foreground">
            <span className="text-sm opacity-65">Giá bán</span>
            <span className="mt-auto pt-4 text-2xl font-light tabular">
              {(() => {
                const prices = data.variants.map((v) => v.price);
                const [min, max] = [Math.min(...prices), Math.max(...prices)];
                return min === max ? formatVND(min) : `${formatVND(min)} – ${formatVND(max)}`;
              })()}
            </span>
          </div>
        </section>
      </div>

      {/* Variants */}
      <section aria-labelledby="variants-heading" className="rounded-3xl bg-card p-3 sm:p-5">
        <h2 id="variants-heading" className="px-2 pb-3 text-xl font-normal tracking-[-0.02em]">
          Mẫu và tồn kho
        </h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 pb-3 font-normal">
                  Mẫu
                </th>
                <th scope="col" className="px-3 pb-3 font-normal">
                  Giá bán
                </th>
                {seeCost && (
                  <th scope="col" className="px-3 pb-3 font-normal">
                    Giá vốn
                  </th>
                )}
                {locations.map((l) => (
                  <th key={l.id} scope="col" className="px-3 pb-3 text-right font-normal whitespace-nowrap">
                    {l.name}
                  </th>
                ))}
                <th scope="col" className="px-3 pb-3 font-normal">
                  Kênh bán
                </th>
                <th scope="col" className="px-3 pb-3">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.variants.map((v, i) => (
                <tr key={v.id} className={cn("align-top", i % 2 === 0 && "bg-muted/50")}>
                  <th scope="row" className="rounded-l-[20px] px-3 py-3 text-left font-normal whitespace-nowrap">
                    <span className="font-medium">{v.name}</span>
                    <span className="block text-xs text-muted-foreground tabular">
                      {v.sku}
                      {v.barcode && `, ${v.barcode}`}
                    </span>
                  </th>
                  <td className="px-3 py-2">
                    {canPrice && data.status !== "ARCHIVED" ? (
                      <PriceInput value={v.price} label={`Giá bán ${v.name}`} onSave={(price) => savePrice(v.id, { price })} />
                    ) : (
                      <span className="inline-block py-2 font-medium tabular">{formatVND(v.price)}</span>
                    )}
                  </td>
                  {seeCost && (
                    <td className="px-3 py-2">
                      {canPrice && data.status !== "ARCHIVED" ? (
                        <PriceInput value={v.costPrice ?? 0} label={`Giá vốn ${v.name}`} onSave={(costPrice) => savePrice(v.id, { costPrice })} />
                      ) : (
                        <span className="inline-block py-2 tabular">{v.costPrice != null ? formatVND(v.costPrice) : "—"}</span>
                      )}
                    </td>
                  )}
                  {locations.map((l) => {
                    const lv = v.levels.find((x) => x.locationId === l.id);
                    const low = lv && lv.available > 0 && lv.onHand <= lv.reorderPoint;
                    const out = !lv || lv.available <= 0;
                    return (
                      <td key={l.id} className="px-3 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {out && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Hết</span>}
                          {low && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-ink">Sắp hết</span>}
                          <span className="text-[15px] font-medium tabular">{formatNumber(lv?.available ?? 0)}</span>
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3">
                    <SyncStatus listings={v.listings} detailed />
                  </td>
                  <td className="rounded-r-[20px] px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {can("inventory:adjust") && (
                        <RowAction label={`Điều chỉnh tồn ${v.name}`} onClick={() => setAdjusting(toTarget(v))}>
                          <SlidersHorizontal className="size-4" aria-hidden />
                        </RowAction>
                      )}
                      {can("inventory:transfer") && (
                        <RowAction label={`Chuyển kho ${v.name}`} onClick={() => setTransferring(toTarget(v))}>
                          <ArrowLeftRight className="size-4" aria-hidden />
                        </RowAction>
                      )}
                      <RowAction label={`Lịch sử tồn kho ${v.name}`} onClick={() => setHistory(toTarget(v))}>
                        <History className="size-4" aria-hidden />
                      </RowAction>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!canPrice && <p className="px-2 pt-3 text-xs text-muted-foreground">Giá bán chỉ Admin và Quản lý được sửa.</p>}
      </section>

      <AdjustStockDialog target={adjusting} locations={locations} onClose={() => setAdjusting(null)} onDone={(vid, level) => patchVariant(vid, (v) => ({ ...v, levels: patchLevels(v.levels, level) }))} />
      <TransferStockDialog target={transferring} locations={locations} onClose={() => setTransferring(null)} onDone={(vid, levels) => patchVariant(vid, (v) => ({ ...v, levels: levels.reduce(patchLevels, v.levels) }))} />
      <MovementHistoryDialog target={history} onClose={() => setHistory(null)} />
      <EditProductDialog open={editing} product={data} onClose={() => setEditing(false)} onSaved={(p) => mutate(() => p)} />
      <ArchiveDialog
        open={archiving}
        product={data}
        onClose={() => setArchiving(false)}
        onArchived={() => router.replace("/app/products")}
      />
    </div>
  );
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground hover:bg-lime hover:text-lime-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function EditProductDialog({ open, product, onClose, onSaved }: { open: boolean; product: ProductDetail; onClose: () => void; onSaved: (p: ProductDetail) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Sửa thông tin sản phẩm">
      <EditForm product={product} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function EditForm({ product, onClose, onSaved }: { product: ProductDetail; onClose: () => void; onSaved: (p: ProductDetail) => void }) {
  const { data: categories = [] } = useApiQuery<CategorySummary[]>("/categories");
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [description, setDescription] = useState(product.description ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">(product.status === "DRAFT" ? "DRAFT" : "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const p = await api<ProductDetail>(`/products/${product.id}`, { method: "PATCH", json: { name, categoryId: categoryId || undefined, description, status } });
      onSaved(p);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && !error.body.details && <InlineError message={error.message} />}
      <FormField label="Tên sản phẩm" required value={name} onChange={(e) => setName(e.target.value)} error={error?.field("name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Danh mục" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Chưa phân loại</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DRAFT")}>
          <option value="ACTIVE">Đang bán</option>
          <option value="DRAFT">Nháp (ẩn khỏi bán hàng)</option>
        </SelectField>
      </div>
      <div>
        <label htmlFor="desc" className="mb-1.5 block text-sm font-medium">
          Mô tả
        </label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={5000}
          className="w-full rounded-3xl border border-input bg-card px-5 py-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Lưu thay đổi
        </button>
      </div>
    </form>
  );
}

function ArchiveDialog({ open, product, onClose, onArchived }: { open: boolean; product: ProductDetail; onClose: () => void; onArchived: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Lưu trữ “${product.name}”?`}
      description="Sản phẩm sẽ ẩn khỏi bán hàng và tồn kho. Lịch sử đơn hàng và sổ kho vẫn được giữ nguyên."
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "md" })}>
            Huỷ
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await api(`/products/${product.id}`, { method: "DELETE" });
                onArchived();
              } catch (e) {
                setError((e as Error).message);
                setPending(false);
              }
            }}
            className={cn(buttonVariants({ size: "md" }), "bg-destructive text-white hover:bg-destructive/90")}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Lưu trữ sản phẩm
          </button>
        </>
      }
    >
      {error ? <InlineError message={error} /> : null}
    </Dialog>
  );
}
