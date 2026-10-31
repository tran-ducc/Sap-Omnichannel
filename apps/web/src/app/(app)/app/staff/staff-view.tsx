"use client";

import type { LocationSummary, RoleKey, StaffMember, TemporaryCredential } from "@omni/shared";
import { Check, Copy, KeyRound, Loader2, Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/app/app-shell";
import { Segmented, SelectField } from "@/components/app/controls";
import { Dialog } from "@/components/app/dialog";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { EmptyState, ErrorState, InlineError, RowsSkeleton } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, ApiRequestError } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/domain";
import { formatNumber, formatVNDCompact, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_NOTE: Record<RoleKey, string> = {
  ADMIN: "Toàn quyền, kể cả cài đặt hệ thống và xoá cửa hàng",
  MANAGER: "Quản lý hàng, đơn, báo cáo và nhân viên; không xoá cửa hàng",
  STAFF: "Chỉ bán tại quầy và xử lý đơn được giao",
};
const STATUS_LABEL = { ACTIVE: "Đang làm", INVITED: "Chưa đăng nhập", DISABLED: "Đã khoá" } as const;

export function StaffView() {
  const { can, session } = useSession();
  const { data, error, reload, mutate } = useApiQuery<StaffMember[]>("/staff");
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");
  const [filter, setFilter] = useState<"ALL" | RoleKey | "DISABLED">("ALL");
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [credential, setCredential] = useState<TemporaryCredential | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);

  const assignable: RoleKey[] = session?.role === "ADMIN" ? ["ADMIN", "MANAGER", "STAFF"] : ["STAFF"];
  const shown = (data ?? []).filter((m) => (filter === "ALL" ? m.status !== "DISABLED" : filter === "DISABLED" ? m.status === "DISABLED" : m.role === filter && m.status !== "DISABLED"));
  const count = (f: typeof filter) => (data ?? []).filter((m) => (f === "DISABLED" ? m.status === "DISABLED" : m.status !== "DISABLED" && (f === "ALL" || m.role === f))).length;
  const locName = (ids: string[]) => (ids.length === 0 ? "Tất cả chi nhánh" : ids.map((id) => locations.find((l) => l.id === id)?.name ?? "…").join(", "));
  const replace = (m: StaffMember) => mutate((list) => list.map((x) => (x.userId === m.userId ? m : x)));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative -mx-1 overflow-x-auto px-1">
          <Segmented
            label="Lọc nhân viên"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: `Đang làm (${count("ALL")})` },
              { value: "ADMIN", label: `Admin (${count("ADMIN")})` },
              { value: "MANAGER", label: `Quản lý (${count("MANAGER")})` },
              { value: "STAFF", label: `Nhân viên (${count("STAFF")})` },
              { value: "DISABLED", label: `Đã khoá (${count("DISABLED")})` },
            ]}
            className="w-fit flex-nowrap"
          />
        </div>
        {can("staff:manage") && (
          <button type="button" onClick={() => setEditing("new")} className={cn(buttonVariants({ size: "md" }), "w-fit sm:ml-auto")}>
            <Plus className="size-4" aria-hidden />
            Thêm nhân viên
          </button>
        )}
      </div>

      {!data && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={4} className="rounded-3xl bg-card p-4" />
      ) : shown.length === 0 ? (
        <EmptyState icon={UserCog} title="Không có ai trong nhóm này" className="bg-card" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((m) => (
            <li key={m.userId} className={cn("flex min-w-0 flex-col rounded-3xl p-5", m.role === "ADMIN" ? "bg-night text-night-foreground" : "bg-card", m.status === "DISABLED" && "opacity-70")}>
              <div className="flex items-start gap-3">
                <Avatar name={m.fullName} url={m.avatarUrl} className="size-12 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-normal tracking-[-0.01em]">
                    {m.fullName}
                    {m.isSelf && <span className="ml-2 text-xs opacity-60">(bạn)</span>}
                  </p>
                  <p className={cn("truncate text-sm", m.role === "ADMIN" ? "opacity-65" : "text-muted-foreground")}>{m.email}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", m.role === "ADMIN" ? "bg-lime text-lime-foreground" : m.role === "MANAGER" ? "bg-lime-soft" : "bg-muted")}>{ROLE_LABEL[m.role]}</span>
              </div>
              <dl className={cn("mt-4 grid grid-cols-2 gap-2 text-sm", m.role === "ADMIN" ? "[&_dt]:opacity-60" : "[&_dt]:text-muted-foreground")}>
                <div>
                  <dt className="text-xs">Đơn tại quầy tháng này</dt>
                  <dd className="tabular">
                    {formatNumber(m.ordersThisMonth)} đơn, {formatVNDCompact(m.revenueThisMonth)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs">Trạng thái</dt>
                  <dd>
                    {STATUS_LABEL[m.status]}
                    {m.lastLoginAt && m.status === "ACTIVE" && <span className="block text-xs opacity-60">vào {timeAgo(m.lastLoginAt)}</span>}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs">Chi nhánh</dt>
                  <dd className="truncate">{locName(m.locationIds)}</dd>
                </div>
              </dl>
              {m.editable && (
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => setEditing(m)} className={cn(cn(buttonVariants({ variant: "outline", size: "md" }), "h-9 px-4"), m.role === "ADMIN" && "border-night-foreground/25 bg-transparent text-night-foreground hover:bg-night-foreground/10")}>
                    <Pencil className="size-3.5" aria-hidden />
                    Sửa
                  </button>
                  {m.status !== "DISABLED" && (
                    <button type="button" onClick={() => setResetting(m)} className={cn(cn(buttonVariants({ variant: "ghost", size: "md" }), "h-9 px-4"), m.role === "ADMIN" && "text-night-foreground hover:bg-night-foreground/10")}>
                      <KeyRound className="size-3.5" aria-hidden />
                      Đặt lại mật khẩu
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 px-4 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
        {session?.role === "ADMIN" ? "Admin quản lý được mọi tài khoản trừ chính mình." : "Quản lý chỉ thêm và sửa được tài khoản Nhân viên."} Thay đổi vai trò hoặc khoá tài khoản có hiệu lực trong tối đa 15 phút với phiên đang mở.
      </p>

      <MemberDialog
        target={editing}
        roles={assignable}
        locations={locations}
        onClose={() => setEditing(null)}
        onAdded={(c) => {
          setEditing(null);
          mutate((list) => [...list, c.member]);
          setCredential(c);
        }}
        onUpdated={(m) => {
          setEditing(null);
          replace(m);
        }}
      />
      <ResetDialog
        member={resetting}
        onClose={() => setResetting(null)}
        onDone={(c) => {
          setResetting(null);
          replace(c.member);
          setCredential(c);
        }}
      />
      <CredentialDialog credential={credential} onClose={() => setCredential(null)} />
    </div>
  );
}

function MemberDialog({
  target,
  roles,
  locations,
  onClose,
  onAdded,
  onUpdated,
}: {
  target: StaffMember | "new" | null;
  roles: RoleKey[];
  locations: LocationSummary[];
  onClose: () => void;
  onAdded: (c: TemporaryCredential) => void;
  onUpdated: (m: StaffMember) => void;
}) {
  const member = target && target !== "new" ? target : null;
  return (
    <Dialog open={!!target} onClose={onClose} title={member ? `Sửa ${member.fullName}` : "Thêm nhân viên"} description={member ? member.email : "Hệ thống tạo mật khẩu tạm, bạn gửi lại cho nhân viên."}>
      {target && <MemberForm key={member?.userId ?? "new"} member={member} roles={roles} locations={locations} onClose={onClose} onAdded={onAdded} onUpdated={onUpdated} />}
    </Dialog>
  );
}

function MemberForm({
  member,
  roles,
  locations,
  onClose,
  onAdded,
  onUpdated,
}: {
  member: StaffMember | null;
  roles: RoleKey[];
  locations: LocationSummary[];
  onClose: () => void;
  onAdded: (c: TemporaryCredential) => void;
  onUpdated: (m: StaffMember) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RoleKey>(member?.role ?? "STAFF");
  const [allLocations, setAllLocations] = useState(!member || member.locationIds.length === 0);
  const [locationIds, setLocationIds] = useState<string[]>(member?.locationIds ?? []);
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(member?.status === "DISABLED" ? "DISABLED" : "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const roleChoices = member && !roles.includes(member.role) ? [member.role, ...roles] : roles;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const scope = allLocations ? [] : locationIds;
    try {
      if (member) onUpdated(await api<StaffMember>(`/staff/${member.userId}`, { method: "PATCH", json: { role, locationIds: scope, status } }));
      else onAdded(await api<TemporaryCredential>("/staff", { method: "POST", json: { fullName, email, phone: phone.trim() || undefined, role, locationIds: scope } }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !["fullName", "email", "phone"].some((f) => error.field(f)) && <InlineError message={error.message} />}
      {!member && (
        <>
          <FormField label="Họ tên" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} error={error?.field("fullName")} maxLength={80} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email đăng nhập" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error?.field("email")} />
            <FormField label="Số điện thoại" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={error?.field("phone")} />
          </div>
        </>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Vai trò</legend>
        <div className="space-y-2">
          {roleChoices.map((r) => (
            <label key={r} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition-colors", role === r ? "border-foreground bg-lime-soft" : "border-input hover:bg-muted/60")}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} disabled={!roles.includes(r)} className="mt-0.5 accent-[var(--lime-foreground)]" />
              <span>
                <span className="font-medium">{ROLE_LABEL[r]}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_NOTE[r]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Chi nhánh làm việc</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={allLocations} onChange={(e) => setAllLocations(e.target.checked)} className="size-4 accent-[var(--lime-foreground)]" />
          Tất cả chi nhánh
        </label>
        {!allLocations && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {locations.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-full bg-muted/70 px-4 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={locationIds.includes(l.id)}
                  onChange={(e) => setLocationIds((ids) => (e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id)))}
                  className="size-4 accent-[var(--lime-foreground)]"
                />
                {l.name}
              </label>
            ))}
          </div>
        )}
        {!allLocations && locationIds.length === 0 && <p className="mt-1.5 text-xs text-amber-ink">Chọn ít nhất một chi nhánh, hoặc bật Tất cả chi nhánh.</p>}
      </fieldset>
      {member && (
        <SelectField label="Trạng thái tài khoản" value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DISABLED")}>
          <option value="ACTIVE">Đang làm việc</option>
          <option value="DISABLED">Khoá, không cho đăng nhập</option>
        </SelectField>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className={buttonVariants({ variant: "ghost", size: "md" })}>
          Huỷ
        </button>
        <button type="submit" disabled={pending || (!allLocations && locationIds.length === 0)} className={buttonVariants({ size: "md" })}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {member ? "Lưu thay đổi" : "Thêm và tạo mật khẩu"}
        </button>
      </div>
    </form>
  );
}

function ResetDialog({ member, onClose, onDone }: { member: StaffMember | null; onClose: () => void; onDone: (c: TemporaryCredential) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function reset() {
    if (!member) return;
    setPending(true);
    setError("");
    try {
      onDone(await api<TemporaryCredential>(`/staff/${member.userId}/reset-password`, { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title="Đặt lại mật khẩu?"
      description={member ? `${member.fullName} sẽ bị đăng xuất khỏi mọi thiết bị và phải dùng mật khẩu tạm mới.` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "ghost", size: "md" })}>
            Huỷ
          </button>
          <button type="button" onClick={reset} disabled={pending} className={buttonVariants({ size: "md" })}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Đặt lại
          </button>
        </>
      }
    >
      {error && <InlineError message={error} />}
    </Dialog>
  );
}

function CredentialDialog({ credential, onClose }: { credential: TemporaryCredential | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const pw = credential?.temporaryPassword;
  return (
    <Dialog
      open={!!credential}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      title={pw ? "Mật khẩu tạm" : "Đã thêm vào cửa hàng"}
      description={credential ? (pw ? `Gửi cho ${credential.member.fullName} cùng email ${credential.member.email}. Mật khẩu chỉ hiện một lần.` : `${credential.member.fullName} đã có tài khoản Sạp, họ đăng nhập bằng mật khẩu đang dùng.`) : undefined}
    >
      {pw && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-full bg-night py-2 pr-2 pl-5 text-night-foreground">
            <code className="flex-1 font-mono text-lg tracking-wider">{pw}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(pw).then(() => setCopied(true))}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-medium text-lime-foreground"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Đã chép" : "Chép"}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Nhân viên nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>
        </div>
      )}
    </Dialog>
  );
}
