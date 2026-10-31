import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Báo cáo" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
