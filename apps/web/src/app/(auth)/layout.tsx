import Link from "next/link";
import { AuthArt } from "@/components/auth/auth-art";
import { LogoMark } from "@/components/logo";

/**
 * Auth frame (login, register, forgot/reset password), modelled on the
 * "Orion" reference: dark forest canvas, form on the left, arch photo with a
 * crosshair on the right. The `dark` class pins the app's dark tokens inside,
 * so inputs and buttons look the same whatever theme the visitor uses.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-col bg-[#0b1108] p-3 text-forest-foreground sm:p-5">
      <div className="relative mx-auto grid w-full max-w-[1400px] flex-1 overflow-hidden rounded-3xl bg-forest-deep ring-1 ring-forest-foreground/10 lg:grid-cols-[1fr_1fr]">
        {/* Hatched corner texture, bottom-left (reference detail) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-48 w-2/3 opacity-[0.07] lg:w-1/2"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)", maskImage: "linear-gradient(to top right, #000, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative flex flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
          <Link href="/" aria-label="Sạp, về trang chủ" className="inline-flex items-center gap-2 self-start rounded-lg focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none">
            <LogoMark className="size-7" />
            <span className="text-lg font-semibold tracking-tight">Sạp</span>
          </Link>
          <main className="flex flex-1 items-center py-10">
            <div className="w-full max-w-md">{children}</div>
          </main>
          <p className="text-xs text-forest-foreground/40">© 2026 Sạp. Quản lý bán hàng đa kênh.</p>
        </div>

        <div className="hidden pt-10 pr-10 lg:block">
          <AuthArt />
        </div>
      </div>
    </div>
  );
}
