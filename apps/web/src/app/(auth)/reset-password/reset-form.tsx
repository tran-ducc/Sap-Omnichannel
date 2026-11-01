"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/app/form-field";
import { AuthHeadline } from "@/components/auth/auth-bits";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = repeat !== "" && repeat !== password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setPending(true);
    setError(null);
    try {
      await api("/auth/reset-password", { method: "POST", json: { token, newPassword: password } });
      setPassword("");
      setRepeat("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <>
        <AuthHeadline sub="Liên kết đặt lại mật khẩu bị thiếu mã. Hãy mở lại đúng liên kết, hoặc yêu cầu liên kết mới.">Liên kết này không dùng được</AuthHeadline>
        <Link href="/forgot-password" className={cn(buttonVariants({ size: "xl" }), "mt-8 w-full")}>
          Yêu cầu liên kết mới
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeadline sub="Sau khi đổi, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.">Đặt mật khẩu mới cho tài khoản của bạn</AuthHeadline>

      {done ? (
        <>
          <div role="status" className="mt-8 flex gap-3 rounded-3xl bg-lime-soft p-5 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>Đã đặt mật khẩu mới. Đăng nhập lại bằng mật khẩu vừa tạo.</p>
          </div>
          <Link href="/login" className={cn(buttonVariants({ size: "xl" }), "mt-6 w-full")}>
            Đăng nhập
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="auth-rise mt-8 space-y-5" noValidate>
          {error && !error.field("newPassword") && (
            <div role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}{" "}
              {error.status === 400 && (
                <Link href="/forgot-password" className="font-medium underline underline-offset-4">
                  Yêu cầu liên kết mới
                </Link>
              )}
            </div>
          )}
          <FormField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Ít nhất 8 ký tự, có cả chữ và số"
            error={error?.field("newPassword")}
          />
          <FormField
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            error={mismatch ? "Hai mật khẩu chưa khớp" : undefined}
          />
          <button type="submit" disabled={pending || !password || mismatch} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Đặt mật khẩu mới
          </button>
        </form>
      )}
    </>
  );
}
