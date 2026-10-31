"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/components/app/session-provider";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./content";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const signedIn = useSession().status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        // Scrolled: frosted bar + soft shadow. Duration/ease match the landing motion (globals.css).
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-(--ease-soft)",
        open
          ? "border-border bg-background"
          : scrolled
            ? "border-border/60 bg-background/80 shadow-[0_10px_30px_-24px_rgb(18_20_16/0.5)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
            : "border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Sạp, về trang chủ" className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Logo />
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/app/dashboard" className={cn(buttonVariants({ size: "md" }), "hidden text-[15px] sm:inline-flex")}>
              Vào trang quản lý
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "md" }), "hidden text-[15px] sm:inline-flex")}>
                Đăng nhập
              </Link>
              <Link href="/register" className={cn(buttonVariants({ size: "md" }), "hidden text-[15px] sm:inline-flex")}>
                Dùng thử miễn phí
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Điều hướng di động" className="border-t border-border px-4 pt-2 pb-5 md:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-base font-medium hover:bg-muted">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          {signedIn ? (
            <Link href="/app/dashboard" className={cn(buttonVariants({ size: "md" }), "mt-3 w-full")}>
              Vào trang quản lý
            </Link>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "md" })}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonVariants({ size: "md" })}>
                Dùng thử miễn phí
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
