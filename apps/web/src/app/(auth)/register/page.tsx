import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Tạo cửa hàng" };

export default function RegisterPage() {
  return <RegisterForm />;
}
