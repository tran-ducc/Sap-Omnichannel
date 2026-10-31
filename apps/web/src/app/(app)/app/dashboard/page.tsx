import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Tổng quan" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function DashboardPage() {
  // The range lives in ?range= (shareable link); reading it needs a Suspense boundary.
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
