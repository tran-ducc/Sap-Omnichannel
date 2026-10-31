import type { Metadata } from "next";
import { StaffView } from "./staff-view";

export const metadata: Metadata = { title: "Nhân viên" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function StaffPage() {
  return <StaffView />;
}
