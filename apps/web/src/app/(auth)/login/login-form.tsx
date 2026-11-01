"use client";

import type { ShopChoice } from "@omni/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Loader2, Store } from "lucide-react";
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
  // Account in several shops: the API lists them and we ask which one (credentials kept for the second call).
  const [choice, setChoice] = useState<{ shops: ShopChoice[]; email: string; password: string } | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const next = safeNext(params.get("next"));

  // Already signed in (e.g. came back to /login): go straight to the app.
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function submit(e: FormEvent | null, override?: { email: string; password: string }, tenantSlug?: string) {
    e?.preventDefault();
    setPending(true);
    setError(null);
    const c = override ?? { email, password };
    try {
      await login(c.email, c.password, tenantSlug);
      // Next keeps this page's state alive (hidden) after navigating away, so
      // clear it now or the form comes back disabled after a logout.
      setPassword("");
      setChoice(null);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "ShopSelectionRequired" && err.body.shops?.length) {
        setChoice({ shops: err.body.shops, ...c });
        return;
      }
      setError(err instanceof ApiRequestError ? err : new ApiRequestError({ statusCode: 0, error: "Unknown", message: "Đăng nhập không thành công. Thử lại sau." }));
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  if (choice) {
    return (
      <>
        <h1 className="text-4xl leading-tight font-normal tracking-[-0.035em]">Chọn cửa hàng</h1>
        <p className="mt-2 text-[15px] font-light text-muted-foreground">Tài khoản {choice.email} thuộc nhiều cửa hàng. Bạn muốn vào cửa hàng nào?</p>
        {error && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none">
            {error.message}
          </div>
        )}
        <ul className="mt-8 space-y-2" aria-label="Cửa hàng của bạn">
          {choice.shops.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(null, { email: choice.email, password: choice.password }, s.slug)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-lime-foreground">
                  <Store className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.slug}</span>
                </span>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setChoice(null);
            setError(null);
          }}
          className="mt-6 w-full cursor-pointer text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Đăng nhập bằng tài khoản khác
        </button>
      </>
    );
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
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Quên mật khẩu?
          </Link>
        </p>
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
