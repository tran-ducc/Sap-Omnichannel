"use client";

import type { CategorySummary, Page, ProductListItem } from "@omni/shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackagePlus, PackageSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pagination, SearchBox, Segmented, SelectField } from "@/components/app/controls";
import { ProductThumb } from "@/components/app/product-images";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, ErrorState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { CHANNEL_META } from "@/lib/domain";
import { formatNumber, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

type Status = "ACTIVE" | "DRAFT" | "ARCHIVED";
const STATUS_LABEL: Record<Status, string> = { ACTIVE: "Đang bán", DRAFT: "Nháp", ARCHIVED: "Đã lưu trữ" };

export function ProductsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useSession();

  const status = (["ACTIVE", "DRAFT", "ARCHIVED"].includes(params.get("status") ?? "") ? params.get("status") : "ACTIVE") as Status;
  const categoryId = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim(), 300);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const lastQ = useRef(q);
  useEffect(() => {
    if (lastQ.current === q) return;
    lastQ.current = q;
    setParams({ q: q || null });
    // setParams reads the live URL; only q changes here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = new URLSearchParams({ page: String(page), limit: "24", status, ...(q && { q }), ...(categoryId && { categoryId }) });
  const { data, error, loading, reload } = useApiQuery<Page<ProductListItem>>(`/products?${query}`);
  const { data: categories = [] } = useApiQuery<CategorySummary[]>("/categories");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} label="Tìm sản phẩm" placeholder="Tìm tên, SKU hoặc mã vạch" className="lg:w-80" />
        <SelectField label="Danh mục" hideLabel value={categoryId} onChange={(e) => setParams({ category: e.target.value || null })} className="lg:w-52">
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Segmented
          label="Trạng thái"
          value={status}
          onChange={(v) => setParams({ status: v === "ACTIVE" ? null : v })}
          options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        {can("product:create") && (
          <Link href="/app/products/new" className={cn(buttonVariants({ size: "md" }), "lg:ml-auto")}>
            <PackagePlus className="size-4" aria-hidden />
            Thêm sản phẩm
          </Link>
        )}
      </div>

      <p className="min-h-4 px-4 text-xs text-muted-foreground" aria-live="polite">
        {loading && data ? "Đang tải…" : data ? `${formatNumber(data.total)} sản phẩm` : ""}
      </p>

      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Đang tải">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-card/70" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={q || categoryId ? "Không có sản phẩm phù hợp" : status === "ACTIVE" ? "Chưa có sản phẩm nào" : `Không có sản phẩm ${STATUS_LABEL[status].toLowerCase()}`}
          body={q ? `Không có kết quả cho “${q}”.` : status === "ACTIVE" ? "Thêm sản phẩm đầu tiên để bắt đầu bán trên mọi kênh." : undefined}
          action={
            status === "ACTIVE" && !q && can("product:create") ? (
              <Link href="/app/products/new" className={buttonVariants({ size: "md" })}>
                Thêm sản phẩm
              </Link>
            ) : undefined
          }
          className="bg-card"
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.items.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} tint={i % 3} />
              </li>
            ))}
          </ul>
          <div className="rounded-3xl bg-card px-4 pb-4">
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} />
          </div>
        </>
      )}
    </div>
  );
}

const TINTS = ["bg-lime-soft", "bg-muted", "bg-amber-soft"];

function ProductCard({ product: p, tint }: { product: ProductListItem; tint: number }) {
  return (
    <Link
      href={`/app/products/${p.id}`}
      className="group flex h-full flex-col rounded-3xl bg-card p-3 transition-shadow hover:shadow-[0_16px_32px_-20px_rgb(18_20_16/0.35)] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className={cn("relative flex aspect-[4/3] items-center justify-center rounded-2xl text-3xl font-light tracking-tight", TINTS[tint])}>
        <ProductThumb src={p.imageUrl} name={p.name} className="rounded-2xl" />
        {p.lowStockLevels > 0 && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-amber-ink">Tồn thấp ở {p.lowStockLevels} kho</span>
        )}
        {p.status !== "ACTIVE" && <span className="absolute top-2.5 right-2.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium">{STATUS_LABEL[p.status]}</span>}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
        <p className="font-medium group-hover:underline">{p.name}</p>
        <p className="text-sm text-muted-foreground">
          {p.category ?? "Chưa phân loại"}, {p.variantCount} mẫu
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-lg font-normal tabular">{p.priceMin === p.priceMax ? formatVND(p.priceMin) : `${formatVND(p.priceMin)} – ${formatVND(p.priceMax)}`}</p>
            <p className="text-xs text-muted-foreground tabular">Tồn {formatNumber(p.totalOnHand)}</p>
          </div>
          <ul className="flex -space-x-1" aria-label={`Đang bán trên ${p.channels.length} kênh`}>
            {p.channels.map((c) => (
              <li key={c} title={CHANNEL_META[c].label} className="size-3 rounded-full ring-2 ring-card" style={{ background: CHANNEL_META[c].color }} />
            ))}
          </ul>
        </div>
      </div>
    </Link>
  );
}
