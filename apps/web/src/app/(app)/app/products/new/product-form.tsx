"use client";

import type { CategorySummary, ChannelSummary, ChannelType, LocationSummary, ProductDetail } from "@omni/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SelectField } from "@/components/app/controls";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, ApiRequestError } from "@/lib/api";
import { CHANNEL_META } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { buildSku } from "@/lib/sku";
import { cn } from "@/lib/utils";

interface OptionRow {
  id: number;
  name: string;
  values: string[];
}

/** Per-combination edits, keyed by the combination ("Be|M"), so regenerating keeps what the user typed. */
interface VariantEdits {
  sku?: string;
  price?: string;
  cost?: string;
  stock: Record<string, string>;
}

const digits = (s: string) => s.replace(/\D/g, "");

function combinations(options: OptionRow[]): string[][] {
  const filled = options.filter((o) => o.name.trim() && o.values.length);
  return filled.reduce<string[][]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v])), [[]]);
}

export function ProductForm() {
  const router = useRouter();
  const { can } = useSession();
  const { data: categories = [] } = useApiQuery<CategorySummary[]>("/categories");
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");
  const { data: channels = [] } = useApiQuery<ChannelSummary[]>("/channels");

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([
    { id: 1, name: "Màu", values: [] },
    { id: 2, name: "Size", values: [] },
  ]);
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultCost, setDefaultCost] = useState("");
  const [edits, setEdits] = useState<Record<string, VariantEdits>>({});
  // undefined = every connected online channel (the usual choice)
  const [pickedChannels, setPickedChannels] = useState<ChannelType[] | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(3);

  const onlineChannels = channels.filter((c) => c.type !== "POS" && c.status === "CONNECTED");
  const selectedChannels = pickedChannels ?? onlineChannels.map((c) => c.type);
  const optionNames = options.filter((o) => o.name.trim() && o.values.length).map((o) => o.name.trim());
  const combos = useMemo(() => combinations(options), [options]);
  const seeCost = can("product:update_price");

  const rows = combos.map((values) => {
    const key = values.join("|");
    const e = edits[key] ?? { stock: {} };
    return {
      key,
      values,
      label: values.length ? values.join(", ") : "Mặc định",
      sku: e.sku ?? buildSku(name || "SP", values),
      price: e.price ?? defaultPrice,
      cost: e.cost ?? defaultCost,
      stock: e.stock,
    };
  });

  const edit = (key: string, patch: Partial<VariantEdits>) => setEdits((all) => ({ ...all, [key]: { ...(all[key] ?? { stock: {} }), ...patch } }));

  if (!can("product:create")) {
    return <EmptyState icon={Lock} title="Bạn chưa có quyền thêm sản phẩm" body="Chỉ Admin và Quản lý được tạo sản phẩm mới." className="bg-card" />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const product = await api<ProductDetail>("/products", {
        method: "POST",
        json: {
          name,
          categoryId: categoryId || undefined,
          brand: brand.trim() || undefined,
          description: description.trim() || undefined,
          options: options.filter((o) => o.name.trim() && o.values.length).map((o) => ({ name: o.name.trim(), values: o.values })),
          variants: rows.map((r) => ({
            attributes: Object.fromEntries(optionNames.map((n, i) => [n, r.values[i]])),
            sku: r.sku,
            price: Number(digits(r.price) || 0),
            ...(seeCost && r.cost && { costPrice: Number(digits(r.cost)) }),
            initialStock: Object.entries(r.stock)
              .filter(([, q]) => Number(q) > 0)
              .map(([locationId, q]) => ({ locationId, quantity: Number(q) })),
          })),
          channelTypes: selectedChannels,
        },
      });
      router.replace(`/app/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  // "variants.3.sku" → error for row 3
  const rowError = (i: number) => error?.body.details?.filter((d) => d.field.startsWith(`variants.${i}.`)).map((d) => d.message).join(" ");
  const missingPrice = rows.some((r) => !digits(r.price));

  return (
    <form onSubmit={submit} noValidate className="space-y-3 pb-28">
      <Link href="/app/products" className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả sản phẩm
      </Link>

      {error && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-3xl bg-destructive/10 px-5 py-4 text-sm text-destructive outline-none">
          <p className="font-medium">{error.message}</p>
          {error.body.details && error.body.details.length > 1 && (
            <ul className="mt-1 list-disc pl-5">
              {error.body.details.map((d, i) => (
                <li key={i}>{d.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Basics */}
        <section aria-labelledby="basics" className="space-y-5 rounded-3xl bg-card p-5 sm:p-6 lg:col-span-7">
          <h2 id="basics" className="text-xl font-normal tracking-[-0.02em]">
            Thông tin cơ bản
          </h2>
          <FormField label="Tên sản phẩm" required value={name} onChange={(e) => setName(e.target.value)} error={error?.field("name")} placeholder="Ví dụ: Áo len gân cổ tròn" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Danh mục" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Chưa phân loại</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <FormField label="Thương hiệu" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              Mô tả
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="w-full rounded-3xl border border-input bg-card px-5 py-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </section>

        {/* Options */}
        <section aria-labelledby="options" className="rounded-3xl bg-muted p-5 sm:p-6 lg:col-span-5">
          <h2 id="options" className="text-xl font-normal tracking-[-0.02em]">
            Thuộc tính
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Mỗi tổ hợp giá trị sẽ thành một mẫu riêng với SKU và tồn kho riêng. Bỏ trống nếu sản phẩm chỉ có một mẫu.</p>
          <ul className="mt-5 space-y-3">
            {options.map((o) => (
              <li key={o.id} className="rounded-2xl bg-card p-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Tên thuộc tính"
                    value={o.name}
                    onChange={(e) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)))}
                    placeholder="Tên thuộc tính"
                    className="h-10 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                  <button
                    type="button"
                    onClick={() => setOptions((all) => all.filter((x) => x.id !== o.id))}
                    aria-label={`Xoá thuộc tính ${o.name || ""}`}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <TagInput label={`Giá trị của ${o.name || "thuộc tính"}`} values={o.values} onChange={(values) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, values } : x)))} />
              </li>
            ))}
          </ul>
          {options.length < 3 && (
            <button
              type="button"
              onClick={() => setOptions((all) => [...all, { id: nextId.current++, name: "", values: [] }])}
              className={cn(buttonVariants({ variant: "outline", size: "md" }), "mt-3 bg-card")}
            >
              <Plus className="size-4" aria-hidden />
              Thêm thuộc tính
            </button>
          )}
        </section>
      </div>

      {/* Variants */}
      <section aria-labelledby="variants" className="rounded-3xl bg-card p-3 sm:p-5">
        <div className="flex flex-col gap-3 px-2 pb-4 md:flex-row md:items-end">
          <div className="flex-1">
            <h2 id="variants" className="text-xl font-normal tracking-[-0.02em]">
              {rows.length} mẫu sản phẩm
            </h2>
            <p className="text-sm text-muted-foreground">Nhập giá chung rồi chỉnh riêng từng mẫu nếu cần.</p>
          </div>
          <MoneyField label="Giá bán chung" value={defaultPrice} onChange={setDefaultPrice} />
          {seeCost && <MoneyField label="Giá vốn chung" value={defaultCost} onChange={setDefaultCost} />}
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 pb-2 font-normal">
                  Mẫu
                </th>
                <th scope="col" className="px-3 pb-2 font-normal">
                  SKU
                </th>
                <th scope="col" className="px-3 pb-2 font-normal">
                  Giá bán
                </th>
                {seeCost && (
                  <th scope="col" className="px-3 pb-2 font-normal">
                    Giá vốn
                  </th>
                )}
                {locations.map((l) => (
                  <th key={l.id} scope="col" className="px-3 pb-2 font-normal">
                    Tồn đầu, {l.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className={cn("align-top", i % 2 === 0 && "bg-muted/50")}>
                  <th scope="row" className="rounded-l-[20px] px-3 py-3 text-left font-medium">
                    {r.label}
                    {rowError(i) && <span className="mt-1 block text-xs font-normal text-destructive">{rowError(i)}</span>}
                  </th>
                  <td className="px-2 py-2">
                    <CellInput label={`SKU ${r.label}`} value={r.sku} onChange={(v) => edit(r.key, { sku: v.toUpperCase() })} className="w-44 font-mono uppercase" />
                  </td>
                  <td className="px-2 py-2">
                    <CellInput label={`Giá bán ${r.label}`} value={r.price ? formatNumber(Number(digits(r.price))) : ""} onChange={(v) => edit(r.key, { price: digits(v) })} inputMode="numeric" placeholder="0" className="w-32 text-right" />
                  </td>
                  {seeCost && (
                    <td className="px-2 py-2">
                      <CellInput label={`Giá vốn ${r.label}`} value={r.cost ? formatNumber(Number(digits(r.cost))) : ""} onChange={(v) => edit(r.key, { cost: digits(v) })} inputMode="numeric" placeholder="0" className="w-32 text-right" />
                    </td>
                  )}
                  {locations.map((l, li) => (
                    <td key={l.id} className={cn("px-2 py-2", li === locations.length - 1 && "rounded-r-[20px]")}>
                      <CellInput
                        label={`Tồn đầu ${r.label} tại ${l.name}`}
                        value={r.stock[l.id] ?? ""}
                        onChange={(v) => edit(r.key, { stock: { ...r.stock, [l.id]: digits(v) } })}
                        inputMode="numeric"
                        placeholder="0"
                        className="w-24 text-right"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Channels */}
      <section aria-labelledby="channels" className="rounded-3xl bg-card p-5 sm:p-6">
        <h2 id="channels" className="text-xl font-normal tracking-[-0.02em]">
          Bán trên kênh
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Sau khi lưu, tồn kho được đưa vào hàng đợi đồng bộ của các kênh đã chọn (đang giả lập, chưa nối API sàn). Luôn bán được tại quầy.</p>
        {onlineChannels.length === 0 ? (
          <p className="mt-4 text-sm">Chưa bật kênh online nào. Vào Cài đặt để bật đồng bộ giả lập cho Shopee, Lazada, TikTok Shop hoặc Facebook.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {onlineChannels.map((c) => {
              const on = selectedChannels.includes(c.type);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPickedChannels(on ? selectedChannels.filter((t) => t !== c.type) : [...selectedChannels, c.type])}
                    className={cn(
                      "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      on ? "bg-lime font-medium text-lime-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="size-2 rounded-full" style={{ background: CHANNEL_META[c.type].color }} aria-hidden />
                    {CHANNEL_META[c.type].label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-full bg-night p-2 pl-5 text-night-foreground shadow-lg sm:inset-x-auto sm:right-5 sm:w-[min(36rem,calc(100%-2.5rem))] lg:right-6">
        <p className="truncate text-sm opacity-80">
          {missingPrice ? "Cần nhập giá bán cho mọi mẫu" : `${rows.length} mẫu, ${selectedChannels.length} kênh online`}
        </p>
        <div className="flex gap-2">
          <Link href="/app/products" className={cn(buttonVariants({ variant: "ghost", size: "md" }), "text-night-foreground hover:bg-night-foreground/10 hover:text-night-foreground")}>
            Huỷ
          </Link>
          <button type="submit" disabled={pending || !name.trim() || missingPrice} className={cn(buttonVariants({ size: "md" }), "bg-lime text-lime-foreground hover:bg-lime/90")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Lưu sản phẩm
          </button>
        </div>
      </div>
    </form>
  );
}

function TagInput({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !values.includes(s));
    if (parts.length) onChange([...values, ...parts]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl px-1 py-1">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-lime py-1 pr-1 pl-3 text-sm text-lime-foreground">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Xoá giá trị ${v}`} className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-lime-foreground/10">
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={values.length ? "Thêm giá trị" : "Gõ giá trị rồi nhấn Enter, ví dụ: Be"}
        className="h-9 min-w-40 flex-1 bg-transparent px-2 text-sm outline-none"
      />
    </div>
  );
}

function CellInput({ label, value, onChange, className, ...rest }: { label: string; value: string; onChange: (v: string) => void; className?: string; inputMode?: "numeric"; placeholder?: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-10 rounded-full border border-input bg-card px-3 text-sm tabular outline-none focus-visible:ring-3 focus-visible:ring-ring/30", className)}
      {...rest}
    />
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FormField
      label={label}
      inputMode="numeric"
      value={value ? formatNumber(Number(value)) : ""}
      onChange={(e) => onChange(digits(e.target.value))}
      placeholder="0"
      className="md:w-44"
    />
  );
}
