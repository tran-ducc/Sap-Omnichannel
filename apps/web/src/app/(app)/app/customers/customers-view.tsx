"use client";

import type { CustomerDetail, CustomerListItem, Page } from "@omni/shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown, Loader2, Pencil, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pagination, SearchBox, Segmented, SelectField } from "@/components/app/controls";
import { Dialog } from "@/components/app/dialog";
import { FormField } from "@/components/app/form-field";
import { ChannelTag, StatusPill } from "@/components/app/order-bits";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebounced } from "@/hooks/use-debounced";
import { api, ApiRequestError } from "@/lib/api";
import { CHANNEL_META, initials } from "@/lib/domain";
import { formatNumber, formatVND, formatVNDCompact, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Sort = "spent" | "recent" | "orders" | "name" | "new";
const TAGS = ["VIP", "Thân thiết", "Sỉ", "Mới"];

export function CustomersView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useSession();

  const tag = params.get("tag") ?? "";
  const sort = (params.get("sort") as Sort | null) ?? "spent";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openId = params.get("id");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim(), 300);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch) && !("id" in patch)) next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const lastQ = useRef(q);
  useEffect(() => {
    if (lastQ.current === q) return;
    lastQ.current = q;
    setParams({ q: q || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = new URLSearchParams({ page: String(page), limit: "25", sort, ...(q && { q }), ...(tag && { tag }) });
  const { data, error, loading, reload } = useApiQuery<Page<CustomerListItem>>(`/customers?${query}`);
  const [editing, setEditing] = useState<CustomerDetail | "new" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 xl:flex-row xl:items-center">
        <SearchBox value={search} onChange={setSearch} label="Tìm khách hàng" placeholder="Tên, số điện thoại hoặc email" className="xl:w-80" />
        <div className="relative -mx-1 overflow-x-auto px-1">
          <Segmented
            label="Lọc theo nhãn"
            value={tag || "ALL"}
            onChange={(v) => setParams({ tag: v === "ALL" ? null : v })}
            options={[{ value: "ALL", label: "Tất cả" }, ...TAGS.map((t) => ({ value: t, label: t }))]}
            className="w-fit flex-nowrap"
          />
        </div>
        <SelectField label="Sắp xếp" hideLabel value={sort} onChange={(e) => setParams({ sort: e.target.value === "spent" ? null : e.target.value })} className="xl:w-56">
          <option value="spent">Chi tiêu nhiều nhất</option>
          <option value="orders">Mua nhiều đơn nhất</option>
          <option value="recent">Mua gần đây</option>
          <option value="new">Khách mới thêm</option>
          <option value="name">Tên A–Z</option>
        </SelectField>
        {can("customer:manage") && (
          <button type="button" onClick={() => setEditing("new")} className={cn(buttonVariants({ size: "md" }), "w-fit xl:ml-auto")}>
            <Plus className="size-4" aria-hidden />
            Thêm khách
          </button>
        )}
      </div>

      <section aria-label="Danh sách khách hàng" className="rounded-3xl bg-card p-3 sm:p-4">
        {!data && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <RowsSkeleton rows={8} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Users} title={q || tag ? "Không có khách phù hợp" : "Chưa có khách hàng"} body={q ? `Không có khách nào khớp “${q}”.` : "Khách sẽ được lưu khi bạn tạo đơn có thông tin khách, hoặc thêm thủ công."} />
        ) : (
          <>
            <p className="px-3 pb-2 text-xs text-muted-foreground" aria-live="polite">
              {loading ? "Đang cập nhật…" : `${formatNumber(data.total)} khách`}
            </p>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Khách hàng
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      Liên hệ
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Số đơn
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Tổng chi tiêu
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Điểm
                    </th>
                    <th scope="col" className="px-3 pb-3 text-right font-normal">
                      Mua gần nhất
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c, i) => (
                    <tr key={c.id} className={cn("group", i % 2 === 0 && "bg-muted/50")}>
                      <td className="rounded-l-full px-3 py-2.5">
                        <button type="button" onClick={() => setParams({ id: c.id })} className="flex cursor-pointer items-center gap-3 text-left focus-visible:outline-none">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-semibold text-lime-foreground" aria-hidden>
                            {initials(c.fullName)}
                          </span>
                          <span>
                            <span className="font-medium group-hover:underline">{c.fullName}</span>
                            {c.tags.length > 0 && (
                              <span className="ml-2 inline-flex gap-1 align-middle">
                                {c.tags.map((t) => (
                                  <TagPill key={t} tag={t} />
                                ))}
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground tabular">
                        {c.phone ?? "—"}
                        {c.email && <span className="block text-xs">{c.email}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{formatNumber(c.orderCount)}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular">{formatVND(c.totalSpent)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{formatNumber(c.loyaltyPoints)}</td>
                      <td className="rounded-r-full px-3 py-2.5 text-right text-muted-foreground">{c.lastOrderAt ? timeAgo(c.lastOrderAt) : "Chưa mua"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} limit={data.limit} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>

      <CustomerPanel id={openId} onClose={() => setParams({ id: null })} onEdit={setEditing} />
      <CustomerFormDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={(c) => {
          setEditing(null);
          reload();
          setParams({ id: c.id });
        }}
      />
    </div>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tag === "VIP" ? "bg-night text-night-foreground" : "bg-lime-soft text-foreground")}>
      {tag === "VIP" && <Crown className="size-3 text-lime" aria-hidden />}
      {tag}
    </span>
  );
}

function CustomerPanel({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (c: CustomerDetail) => void }) {
  const { can } = useSession();
  const { data, error, reload } = useApiQuery<CustomerDetail>(id ? `/customers/${id}` : null);
  const c = data?.id === id ? data : undefined;
  return (
    <Dialog open={!!id} onClose={onClose} variant="side" title={c?.fullName ?? "Khách hàng"} description={c ? [c.phone, c.email].filter(Boolean).join(", ") || "Chưa có liên hệ" : undefined}>
      {!c && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !c ? (
        <RowsSkeleton rows={5} />
      ) : (
        <div className="space-y-5">
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <TagPill key={t} tag={t} />
              ))}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Tổng chi tiêu" value={formatVND(c.totalSpent)} dark />
            <Stat label="Số đơn" value={formatNumber(c.orderCount)} />
            <Stat label="Trung bình mỗi đơn" value={formatVNDCompact(c.averageOrder)} />
            <Stat label="Điểm tích luỹ" value={formatNumber(c.loyaltyPoints)} />
          </dl>

          {c.channels.length > 0 && (
            <section aria-labelledby="cust-ch">
              <h3 id="cust-ch" className="text-sm text-muted-foreground">
                Mua qua kênh
              </h3>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {c.channels.map((ch) => (
                  <span key={ch.channel} style={{ width: `${(ch.revenue / Math.max(1, c.totalSpent)) * 100}%`, background: CHANNEL_META[ch.channel].color }} />
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {c.channels.map((ch) => (
                  <li key={ch.channel} className="flex justify-between gap-3">
                    <ChannelTag channel={ch.channel} />
                    <span className="tabular">
                      {formatVNDCompact(ch.revenue)}
                      <span className="text-muted-foreground">, {ch.orders} đơn</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="space-y-2 text-sm">
            {c.gender && <Row label="Giới tính" value={c.gender} />}
            {c.birthday && <Row label="Ngày sinh" value={c.birthday.split("-").reverse().join("/")} />}
            {c.address && <Row label="Địa chỉ" value={c.address} />}
            {c.note && <Row label="Ghi chú" value={c.note} />}
            <Row label="Khách từ" value={new Date(c.createdAt).toLocaleDateString("vi-VN")} />
          </dl>

          <section aria-labelledby="cust-orders">
            <h3 id="cust-orders" className="text-sm text-muted-foreground">
              Đơn gần đây
            </h3>
            {c.orders.length === 0 ? (
              <p className="mt-2 text-sm">Khách chưa có đơn nào.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/app/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2.5 text-sm hover:bg-muted">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: CHANNEL_META[o.channelType].color }} title={CHANNEL_META[o.channelType].label} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium tabular">{o.code}</span>
                        <span className="block text-xs text-muted-foreground">{new Date(o.placedAt).toLocaleDateString("vi-VN")}</span>
                      </span>
                      <StatusPill status={o.status} />
                      <span className="w-24 text-right font-medium tabular">{formatVNDCompact(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can("customer:manage") && (
            <button type="button" onClick={() => onEdit(c)} className={buttonVariants({ variant: "outline", size: "md" })}>
              <Pencil className="size-4" aria-hidden />
              Sửa thông tin
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3", dark ? "bg-night text-night-foreground" : "bg-muted/70")}>
      <dt className={cn("text-xs", dark ? "opacity-65" : "text-muted-foreground")}>{label}</dt>
      <dd className="mt-1 text-lg font-light tabular">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}

function CustomerFormDialog({ target, onClose, onSaved }: { target: CustomerDetail | "new" | null; onClose: () => void; onSaved: (c: CustomerDetail) => void }) {
  const editing = target && target !== "new" ? target : null;
  return (
    <Dialog open={!!target} onClose={onClose} title={editing ? "Sửa thông tin khách" : "Thêm khách hàng"}>
      {target && <CustomerForm key={editing?.id ?? "new"} initial={editing} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function CustomerForm({ initial, onClose, onSaved }: { initial: CustomerDetail | null; onClose: () => void; onSaved: (c: CustomerDetail) => void }) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    gender: initial?.gender ?? "",
    birthday: initial?.birthday ?? "",
    address: initial?.address ?? "",
    note: initial?.note ?? "",
  });
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      fullName: form.fullName,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      gender: form.gender || undefined,
      birthday: form.birthday || undefined,
      address: form.address.trim() || undefined,
      note: form.note.trim() || undefined,
      tags,
    };
    try {
      const saved = await api<CustomerDetail>(initial ? `/customers/${initial.id}` : "/customers", { method: initial ? "PATCH" : "POST", json: body });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  const fieldErrors = ["fullName", "phone", "email", "gender", "birthday"];
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !fieldErrors.some((f) => error.field(f)) && <InlineError message={error.message} />}
      <FormField label="Họ tên" required value={form.fullName} onChange={set("fullName")} error={error?.field("fullName")} autoFocus maxLength={80} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Số điện thoại" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} error={error?.field("phone")} placeholder="0901234567" />
        <FormField label="Email" type="email" value={form.email} onChange={set("email")} error={error?.field("email")} />
        <SelectField label="Giới tính" value={form.gender} onChange={set("gender")} error={error?.field("gender")}>
          <option value="">Không rõ</option>
          <option value="Nữ">Nữ</option>
          <option value="Nam">Nam</option>
          <option value="Khác">Khác</option>
        </SelectField>
        <FormField label="Ngày sinh" type="date" value={form.birthday} onChange={set("birthday")} error={error?.field("birthday")} />
      </div>
      <FormField label="Địa chỉ" value={form.address} onChange={set("address")} maxLength={300} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Nhãn</legend>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((list) => (on ? list.filter((x) => x !== t) : [...list, t]))}
                className={cn("h-9 cursor-pointer rounded-full px-4 text-sm transition-colors", on ? "bg-lime font-medium text-lime-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <FormField label="Ghi chú" value={form.note} onChange={set("note")} maxLength={1000} placeholder="Ví dụ: thích màu be, size M" />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "ghost", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {initial ? "Lưu thay đổi" : "Thêm khách"}
        </button>
      </div>
    </form>
  );
}
