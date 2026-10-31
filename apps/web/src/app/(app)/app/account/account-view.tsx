"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/app/app-shell";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { InlineError } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/domain";

export function AccountView() {
  const { session, logout } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [done, setDone] = useState(false);
  if (!session) return null;

  const mismatch = repeat !== "" && repeat !== next;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setPending(true);
    setError(null);
    setDone(false);
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-5">
      <section aria-label="Thông tin tài khoản" className="flex flex-col rounded-3xl bg-night p-6 text-night-foreground md:col-span-2">
        <Avatar name={session.user.fullName} url={session.user.avatarUrl} className="size-16 text-lg" />
        <p className="mt-4 text-2xl font-light tracking-[-0.02em]">{session.user.fullName}</p>
        <p className="text-sm opacity-65">{session.user.email}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-xs opacity-60">Cửa hàng</dt>
            <dd>{session.tenant.name}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-60">Vai trò</dt>
            <dd>
              <span className="mt-1 inline-block rounded-full bg-lime px-3 py-1 text-xs font-medium text-lime-foreground">{ROLE_LABEL[session.role]}</span>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          className="mt-8 inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-night-foreground/25 px-5 text-sm hover:bg-night-foreground/10 md:mt-auto"
        >
          <LogOut className="size-4" aria-hidden />
          Đăng xuất
        </button>
      </section>

      <section aria-labelledby="pw-h" className="rounded-3xl bg-card p-6 md:col-span-3">
        <h2 id="pw-h" className="text-xl font-normal tracking-[-0.02em]">
          Đổi mật khẩu
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {error && !error.field("currentPassword") && !error.field("newPassword") && <InlineError message={error.message} />}
          <FormField label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} error={error?.field("currentPassword")} />
          <FormField label="Mật khẩu mới" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} hint="Ít nhất 8 ký tự, có cả chữ và số" error={error?.field("newPassword")} />
          <FormField label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} error={mismatch ? "Hai mật khẩu chưa khớp" : undefined} />
          <p role="status" className="text-sm text-success">
            {done ? "Đã đổi mật khẩu." : ""}
          </p>
          <button type="submit" disabled={pending || !current || !next || mismatch} className={buttonVariants({ size: "md" })}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Đổi mật khẩu
          </button>
        </form>
      </section>
    </div>
  );
}
