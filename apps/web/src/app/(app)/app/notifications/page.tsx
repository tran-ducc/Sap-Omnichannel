import type { Metadata } from "next";
import { NotificationsView } from "./notifications-view";

export const metadata: Metadata = { title: "Thông báo" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function NotificationsPage() {
  return <NotificationsView />;
}
