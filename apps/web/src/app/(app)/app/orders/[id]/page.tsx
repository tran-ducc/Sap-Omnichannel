import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailView } from "./order-detail";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };
// Client-rendered after session restore — see the note in ../../layout.tsx.
export const instant = false;

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView id={id} />;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}
