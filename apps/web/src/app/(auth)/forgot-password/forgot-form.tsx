"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/app/form-field";
import { AuthHeadline, AuthSwitch } from "@/components/auth/auth-bits";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  // The API answers the same for every email, so this message never reveals whether an account exists.
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", json: { email } });
      setSent(res.message);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : null);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeadline sub="Nhập email đăng nhập. Chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.">Quên mật khẩu? Lấy lại trong một phút</AuthHeadline>

      {sent ? (
        <div role="status" className="mt-8 flex gap-3 rounded-3xl bg-lime-soft p-5 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{sent}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-rise mt-8 space-y-5" noValidate>
          {error && !error.field("email") && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </p>
          )}
          <FormField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error?.field("email")}
            placeholder="ten@cuahang.vn"
          />
          <button type="submit" disabled={pending || !email.trim()} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Gửi liên kết đặt lại
          </button>
        </form>
      )}

      <AuthSwitch prompt="Nhớ ra mật khẩu?" href="/login" action="Đăng nhập" className="mt-8" />
    </>
  );
}
