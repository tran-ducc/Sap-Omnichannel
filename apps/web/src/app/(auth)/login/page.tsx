import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  // useSearchParams (next=, expired=) needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
