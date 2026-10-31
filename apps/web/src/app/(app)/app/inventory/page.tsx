import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryView } from "./inventory-view";

export const metadata: Metadata = { title: "Tồn kho" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function InventoryPage() {
  // Filters live in the URL (?q, ?location, ?low, ?page); reading them needs Suspense.
  return (
    <Suspense>
      <InventoryView />
    </Suspense>
  );
}
