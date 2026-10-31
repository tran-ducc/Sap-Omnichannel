import type { Metadata } from "next";
import { ProductForm } from "./product-form";

export const metadata: Metadata = { title: "Thêm sản phẩm" };
// Client-rendered after session restore — see the note in ../../layout.tsx.
export const instant = false;

export default function NewProductPage() {
  return <ProductForm />;
}
