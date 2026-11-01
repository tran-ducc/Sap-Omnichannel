import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
