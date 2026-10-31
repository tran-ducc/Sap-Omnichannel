import type { Metadata } from "next";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Tạo đơn hàng" };
// Client-rendered after session restore — see the note in ../../layout.tsx.
export const instant = false;

export default function NewOrderPage() {
  return <OrderForm />;
}
