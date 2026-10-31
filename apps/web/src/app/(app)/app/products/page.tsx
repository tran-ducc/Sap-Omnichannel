import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsView } from "./products-view";

export const metadata: Metadata = { title: "Sản phẩm" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsView />
    </Suspense>
  );
}
