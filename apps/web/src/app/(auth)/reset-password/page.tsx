import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Đặt mật khẩu mới", robots: { index: false } };

export default function ResetPasswordPage() {
  // useSearchParams (token=) needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
