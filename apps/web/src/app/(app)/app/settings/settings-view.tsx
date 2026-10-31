"use client";

import type { ChannelDetail, LocationDetail, StoreSettings } from "@omni/shared";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MapPin, Pencil, Plus, Store, Warehouse } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/app/controls";
import { Dialog } from "@/components/app/dialog";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, ApiRequestError } from "@/lib/api";
import { CHANNEL_META } from "@/lib/domain";
import { formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { can } = useSession();
  return (
    <div className="grid gap-3 xl:grid-cols-12">
      {can("settings:store") && <StoreSection />}
      {can("channel:manage") && <ChannelsSection />}
      {can("location:manage") && <LocationsSection />}
      {can("tenant:delete") && <DangerZone />}
    </div>
  );
}

function Section({ id, title, description, action, className, children }: { id: string; title: string; description?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 rounded-3xl bg-card p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-xl font-normal tracking-[-0.02em]">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function StoreSection() {
  const { data, error, reload, mutate } = useApiQuery<StoreSettings>("/settings/store");
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<ApiRequestError | null>(null);
  const [saved, setSaved] = useState(false);
  const value = name ?? data?.name ?? "";

  async function save(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    setSaved(false);
    try {
      const s = await api<StoreSettings>("/settings/store", { method: "PATCH", json: { name: value } });
      mutate(() => s);
      setName(null);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e : null);
    } finally {
      setPending(false);
    }
  }

  return (
    <Section id="store-h" title="Cửa hàng" description="Tên hiển thị trên hoá đơn và trong ứng dụng" className="xl:col-span-5">
      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={3} />
      ) : (
        <div className="space-y-5">
          <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
            <FormField label="Tên cửa hàng" value={value} onChange={(e) => (setName(e.target.value), setSaved(false))} error={err?.field("name") ?? (err ? err.message : undefined)} maxLength={80} className="flex-1" />
            <button type="submit" disabled={pending || value === data.name} className={cn(buttonVariants({ size: "md" }), "sm:mt-7")}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Lưu
            </button>
          </form>
          <p className="text-sm text-success" role="status">
            {saved ? "Đã lưu tên cửa hàng." : ""}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-night p-3 text-night-foreground">
              <dt className="text-xs opacity-65">Gói dịch vụ</dt>
              <dd className="mt-1 text-lg font-light">{data.plan}</dd>
              {data.trialEndsAt && <dd className="text-xs opacity-65">Dùng thử đến {new Date(data.trialEndsAt).toLocaleDateString("vi-VN")}</dd>}
            </div>
            <div className="rounded-2xl bg-muted/70 p-3">
              <dt className="text-xs text-muted-foreground">Mã cửa hàng</dt>
              <dd className="mt-1 truncate font-mono">{data.slug}</dd>
              <dd className="text-xs text-muted-foreground">
                {data.currency}, {data.timezone}
              </dd>
            </div>
            {(
              [
                ["Chi nhánh", data.counts.locations],
                ["Kênh bán", data.counts.channels],
                ["Thành viên", data.counts.members],
                ["Sản phẩm", data.counts.products],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-2xl bg-muted/70 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-light tabular">{formatNumber(n)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function ChannelsSection() {
  const { data, error, reload, mutate } = useApiQuery<ChannelDetail[]>("/settings/channels");
  const { data: locations } = useApiQuery<LocationDetail[]>("/settings/locations");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function update(c: ChannelDetail, patch: { status?: "CONNECTED" | "DISCONNECTED"; defaultLocationId?: string }) {
    setBusy(c.id);
    setErr("");
    try {
      const list = await api<ChannelDetail[]>(`/settings/channels/${c.id}`, { method: "PATCH", json: patch });
      mutate(() => list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section id="channels-h" title="Kênh bán" description="Kết nối sàn và chọn kho xuất hàng cho từng kênh. Tồn kho được đồng bộ lên kênh đang kết nối." className="xl:col-span-7">
      {err && (
        <div className="mb-3">
          <InlineError message={err} />
        </div>
      )}
      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={4} />
      ) : (
        <ul className="space-y-2">
          {data.map((c) => {
            const connected = c.status === "CONNECTED";
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: CHANNEL_META[c.type].color }} aria-hidden>
                    {CHANNEL_META[c.type].label.slice(0, 2)}
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.status === "ERROR" ? "Lỗi kết nối" : connected ? "Đang kết nối" : "Đã ngắt"}
                      {c.type !== "POS" && `, ${formatNumber(c.listings)} sản phẩm`}
                      {c.failedListings > 0 && <span className="text-amber-ink">, {c.failedListings} lỗi đồng bộ</span>}
                      {c.lastSyncedAt && `, đồng bộ ${timeAgo(c.lastSyncedAt)}`}
                    </p>
                  </div>
                </div>
                {c.type !== "POS" && (
                  <>
                    <SelectField
                      label={`Kho xuất hàng cho ${c.name}`}
                      hideLabel
                      value={c.defaultLocationId ?? ""}
                      disabled={busy === c.id || !locations}
                      onChange={(e) => e.target.value && update(c, { defaultLocationId: e.target.value })}
                      className="sm:w-52 [&_select]:h-10 [&_select]:text-sm"
                    >
                      {!c.defaultLocationId && <option value="">Chọn kho xuất hàng</option>}
                      {locations
                        ?.filter((l) => l.isActive)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            Xuất từ {l.name}
                          </option>
                        ))}
                    </SelectField>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={connected}
                      aria-label={`Kết nối ${c.name}`}
                      disabled={busy === c.id}
                      onClick={() => update(c, { status: connected ? "DISCONNECTED" : "CONNECTED" })}
                      className={cn("relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50", connected ? "bg-lime" : "bg-border")}
                    >
                      <span className={cn("absolute top-1 size-5 rounded-full bg-night transition-all", connected ? "left-6" : "left-1")} />
                    </button>
                  </>
                )}
                {c.type === "POS" && <span className="text-xs text-muted-foreground sm:w-[17.5rem] sm:text-right">Luôn bật, bán tại mọi cửa hàng</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function LocationsSection() {
  const { data, error, reload, mutate } = useApiQuery<LocationDetail[]>("/settings/locations");
  const [editing, setEditing] = useState<LocationDetail | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function toggle(l: LocationDetail) {
    setBusy(l.id);
    setErr("");
    try {
      const list = await api<LocationDetail[]>(`/settings/locations/${l.id}`, { method: "PATCH", json: { isActive: !l.isActive } });
      mutate(() => list);
    } catch (e) {
      setErr(`${l.name}: ${(e as Error).message}`);
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      id="loc-h"
      title="Chi nhánh và kho"
      description="Cửa hàng bán tại quầy, kho chỉ lưu và xuất hàng online"
      className="xl:col-span-12"
      action={
        <button type="button" onClick={() => setEditing("new")} className={buttonVariants({ variant: "outline", size: "md" })}>
          <Plus className="size-4" aria-hidden />
          Thêm địa điểm
        </button>
      }
    >
      {err && (
        <div className="mb-3">
          <InlineError message={err} />
        </div>
      )}
      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={3} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((l) => {
            const Icon = l.type === "STORE" ? Store : Warehouse;
            return (
              <li key={l.id} className={cn("flex flex-col rounded-2xl border border-border p-4", !l.isActive && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", l.type === "STORE" ? "bg-lime text-lime-foreground" : "bg-night text-night-foreground")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.code}, {l.type === "STORE" ? "Cửa hàng" : "Kho"}
                      {!l.isActive && ", ngừng hoạt động"}
                    </p>
                  </div>
                  <span className="text-sm tabular">{formatNumber(l.stockUnits)} sp</span>
                </div>
                {(l.address || l.phone) && (
                  <p className="mt-3 flex gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {[l.address, l.phone].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <button type="button" onClick={() => setEditing(l)} className={cn(buttonVariants({ variant: "outline", size: "md" }), "h-9 px-4")}>
                    <Pencil className="size-3.5" aria-hidden />
                    Sửa
                  </button>
                  <button type="button" onClick={() => toggle(l)} disabled={busy === l.id} className={cn(buttonVariants({ variant: "ghost", size: "md" }), "h-9 px-4")}>
                    {busy === l.id && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                    {l.isActive ? "Ngừng hoạt động" : "Mở lại"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Thêm địa điểm" : "Sửa địa điểm"}>
        {editing && (
          <LocationForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={(list) => {
              mutate(() => list);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </Section>
  );
}

function LocationForm({ initial, onClose, onSaved }: { initial: LocationDetail | null; onClose: () => void; onSaved: (list: LocationDetail[]) => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", code: initial?.code ?? "", type: initial?.type ?? "STORE", address: initial?.address ?? "", phone: initial?.phone ?? "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: k === "code" ? e.target.value.toUpperCase() : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const common = { name: form.name, address: form.address.trim() || undefined, phone: form.phone.trim() || undefined };
    try {
      onSaved(
        await api<LocationDetail[]>(initial ? `/settings/locations/${initial.id}` : "/settings/locations", {
          method: initial ? "PATCH" : "POST",
          json: initial ? common : { ...common, code: form.code, type: form.type },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !["name", "code", "phone"].some((f) => error.field(f)) && <InlineError message={error.message} />}
      <FormField label="Tên" required autoFocus value={form.name} onChange={set("name")} error={error?.field("name")} placeholder="Linen House Thảo Điền" maxLength={80} />
      {!initial && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mã" required value={form.code} onChange={set("code")} error={error?.field("code")} placeholder="CN03" hint="Chữ in hoa, số, gạch ngang" maxLength={12} />
          <SelectField label="Loại" value={form.type} onChange={set("type")}>
            <option value="STORE">Cửa hàng (bán tại quầy)</option>
            <option value="WAREHOUSE">Kho (chỉ lưu và xuất hàng)</option>
          </SelectField>
        </div>
      )}
      <FormField label="Địa chỉ" value={form.address} onChange={set("address")} maxLength={300} />
      <FormField label="Số điện thoại" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} error={error?.field("phone")} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "ghost", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {initial ? "Lưu thay đổi" : "Thêm địa điểm"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function DangerZone() {
  const { data } = useApiQuery<StoreSettings>("/settings/store");
  const { logout } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const name = data?.name ?? "";

  async function remove() {
    setPending(true);
    setErr("");
    try {
      await api("/settings/store", { method: "DELETE", json: { confirmName: confirm } });
      await logout();
      router.replace("/");
    } catch (e) {
      setErr((e as Error).message);
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="danger-h" className="rounded-3xl border border-destructive/40 p-5 sm:p-6 xl:col-span-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 id="danger-h" className="text-lg font-normal">
            Xoá cửa hàng
          </h2>
          <p className="text-sm text-muted-foreground">Xoá vĩnh viễn sản phẩm, tồn kho, đơn hàng, khách hàng và tài khoản nhân viên trong cửa hàng. Không thể hoàn tác.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ variant: "destructive", size: "md" })}>
          Xoá cửa hàng
        </button>
      </div>
      <Dialog
        open={open}
        onClose={() => (setOpen(false), setConfirm(""), setErr(""))}
        title="Xoá vĩnh viễn cửa hàng?"
        description={`Nhập đúng tên “${name}” để xác nhận.`}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "ghost", size: "md" })}>
              Huỷ
            </button>
            <button type="button" onClick={remove} disabled={pending || confirm.trim() !== name} className={buttonVariants({ variant: "destructive", size: "md" })}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Tôi hiểu, xoá cửa hàng
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {err && <InlineError message={err} />}
          <FormField label="Tên cửa hàng" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
      </Dialog>
    </section>
  );
}
