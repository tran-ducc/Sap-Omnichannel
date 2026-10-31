"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { buttonVariants } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Field = "shopName" | "fullName" | "email" | "phone" | "password";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useSession();
  const [values, setValues] = useState<Record<Field, string>>({ shopName: "", fullName: "", email: "", phone: "", password: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const bind = (name: Field) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: e.target.value })),
    error: error?.field(name),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await register({ ...values, phone: values.phone.trim() || undefined });
      router.replace("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError({ statusCode: 0, error: "Unknown", message: "Không tạo được cửa hàng. Thử lại sau." }));
      setPending(false);
      // Move focus to the error summary so keyboard and screen-reader users land on it.
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const fieldErrors = error?.body.details ?? [];

  return (
    <>
      <h1 className="text-4xl leading-tight font-normal tracking-[-0.035em]">Tạo cửa hàng</h1>
      <p className="mt-2 text-[15px] font-light text-muted-foreground">Miễn phí 14 ngày, không cần thẻ ngân hàng. Bạn sẽ là Admin của cửa hàng.</p>

      {error && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none">
          <p className="font-medium">{error.message}</p>
          {fieldErrors.length > 1 && (
            <ul className="mt-1 list-disc pl-5">
              {fieldErrors.map((d) => (
                <li key={d.field}>{d.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <FormField label="Tên cửa hàng" required autoComplete="organization" placeholder="Ví dụ: Linen House" {...bind("shopName")} />
        <FormField label="Họ và tên" required autoComplete="name" {...bind("fullName")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Email" type="email" inputMode="email" required autoComplete="email" {...bind("email")} />
          <FormField label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" placeholder="0901234567" {...bind("phone")} />
        </div>
        <FormField
          label="Mật khẩu"
          type="password"
          required
          autoComplete="new-password"
          hint="Ít nhất 8 ký tự, gồm cả chữ và số."
          {...bind("password")}
        />
        <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Đang tạo cửa hàng" : "Tạo cửa hàng"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
