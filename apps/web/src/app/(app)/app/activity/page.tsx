import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityView } from "./activity-view";

export const metadata: Metadata = { title: "Nhật ký hoạt động" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityView />
    </Suspense>
  );
}
