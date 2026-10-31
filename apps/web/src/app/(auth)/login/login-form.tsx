"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { buttonVariants } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@linenhouse.test" },
  { label: "Quản lý", email: "manager@linenhouse.test" },
  { label: "Nhân viên", email: "staff@linenhouse.test" },
];

/** Only same-app paths are allowed as a post-login destination (no open redirects). */
function safeNext(next: string | null) {
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const next = safeNext(params.get("next"));

  // Already signed in (e.g. came back to /login): go straight to the app.
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function submit(e: FormEvent, override?: { email: string; password: string }) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(override?.email ?? email, override?.password ?? password);
      // Next keeps this page's state alive (hidden) after navigating away, so
      // clear it now or the form comes back disabled after a logout.
      setPassword("");
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError({ statusCode: 0, error: "Unknown", message: "Đăng nhập không thành công. Thử lại sau." }));
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-4xl leading-tight font-normal tracking-[-0.035em]">Đăng nhập</h1>
      <p className="mt-2 text-[15px] font-light text-muted-foreground">Chào mừng quay lại. Đăng nhập để vào trang quản lý cửa hàng.</p>

      {params.get("expired") && !error && (
        <p className="mt-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber-ink" role="status">
          Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
        </p>
      )}
      {error && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none">
          {error.message}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.field("email")}
          placeholder="ten@cuahang.vn"
        />
        <FormField
          label="Mật khẩu"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.field("password")}
        />
        <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Đang đăng nhập" : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Chưa có cửa hàng?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Tạo cửa hàng miễn phí
        </Link>
      </p>

      {DEMO_PASSWORD && (
        <div className="mt-10 rounded-3xl border border-dashed border-foreground/20 p-4">
          <p className="text-sm font-medium">Dùng thử bằng tài khoản mẫu</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Cửa hàng mẫu Linen House, chỉ có ở môi trường phát triển.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={pending}
                onClick={(e) => submit(e, { email: a.email, password: DEMO_PASSWORD })}
                className={cn(buttonVariants({ variant: "outline", size: "md" }), "bg-card")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
