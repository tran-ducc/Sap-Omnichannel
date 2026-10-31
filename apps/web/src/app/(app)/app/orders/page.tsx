import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "./orders-view";

export const metadata: Metadata = { title: "Đơn hàng" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
