import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetailView } from "./product-detail";

export const metadata: Metadata = { title: "Chi tiết sản phẩm" };
// Client-rendered after session restore — see the note in ../../layout.tsx.
export const instant = false;

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailView id={id} />;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}
