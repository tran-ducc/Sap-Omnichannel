import Link from "next/link";
import type { CSSProperties } from "react";
import { AuthArt } from "@/components/auth/auth-art";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** Lime primary buttons in both themes, like the landing CTAs (the app's light theme uses black pills). */
const LIME_PRIMARY = { "--primary": "var(--lime)", "--primary-foreground": "var(--lime-foreground)" } as CSSProperties;

/**
 * Auth frame (login, register, forgot/reset password), modelled on the
 * "Orion" reference: form on the left, arch photo with a crosshair on the
 * right. Follows the site theme: cream paper in light mode (landing cream
 * sections), deep green in dark mode; the photo panel stays green in both.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background p-3 sm:p-5" style={LIME_PRIMARY}>
      <div className="relative mx-auto grid w-full max-w-[1400px] flex-1 overflow-hidden rounded-3xl bg-cream text-cream-foreground ring-1 ring-cream-foreground/10 lg:grid-cols-[1fr_1fr]">
        {/* Hatched corner texture, bottom-left (reference detail) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-48 w-2/3 opacity-[0.07] lg:w-1/2"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)", maskImage: "linear-gradient(to top right, #000, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative flex flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="SapOmni, về trang chủ" className="rounded-lg focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none">
              <Logo />
            </Link>
            <ThemeToggle className="text-cream-muted hover:bg-cream-foreground/10 hover:text-cream-foreground" />
          </div>
          <main className="flex flex-1 items-center py-10">
            <div className="w-full max-w-md">{children}</div>
          </main>
          <p className="text-xs text-cream-muted">© 2026 SapOmni. Quản lý bán hàng đa kênh.</p>
        </div>

        <div className="hidden pt-10 pr-10 lg:block">
          <AuthArt />
        </div>
      </div>
    </div>
  );
}
