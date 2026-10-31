import type { Metadata } from "next";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Cài đặt" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function SettingsPage() {
  return <SettingsView />;
}
