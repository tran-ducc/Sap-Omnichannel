import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: "Quản lý cửa hàng", robots: { index: false } };

// Everything under /app renders only after the client restores the session
// (AppShell withholds children until then), so there is no static shell for
// Next's instant-navigation validation to check. Revisit if auth moves to a
// server-readable cookie.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
