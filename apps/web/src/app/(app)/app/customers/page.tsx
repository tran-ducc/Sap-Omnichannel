import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersView } from "./customers-view";

export const metadata: Metadata = { title: "Khách hàng" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}
