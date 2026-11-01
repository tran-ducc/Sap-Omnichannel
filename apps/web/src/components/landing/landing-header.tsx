"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/components/app/session-provider";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/components/marketing/content";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Sits transparent on the green hero; once scrolled it becomes a solid forest
 * bar. Square lime block on the right is the primary action (search button in the reference).
 */
export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const signedIn = useSession().status === "authenticated";
  const cta = signedIn ? { href: "/app/dashboard", label: "Vào trang quản lý" } : { href: "/register", label: "Dùng thử miễn phí" };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 -mb-16 text-forest-foreground transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-(--ease-soft) sm:-mb-20",
        scrolled || open ? "bg-forest-deep/90 shadow-[0_12px_30px_-20px_rgb(0_0_0/0.6)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="flex h-16 items-stretch sm:h-20">
        <Link href="/" aria-label="SapOmni, về trang chủ" className="flex items-center px-5 focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none sm:px-8">
          {/* Header always sits on the dark hero or a dark bar */}
          <Logo onDark />
        </Link>

        <nav aria-label="Điều hướng chính" className="ml-auto hidden md:flex">
          <ul className="flex items-center gap-1 lg:gap-6">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="px-3 py-2 text-xs font-medium tracking-[0.14em] uppercase opacity-85 transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none">
                  {l.label}
                </a>
              </li>
            ))}
            {!signedIn && (
              <li>
                <Link href="/login" className="px-3 py-2 text-xs font-medium tracking-[0.14em] uppercase opacity-85 transition-opacity hover:opacity-100">
                  Đăng nhập
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="ml-auto flex items-center pr-2 md:ml-4 lg:ml-8">
          <ThemeToggle className="text-forest-foreground/80 hover:bg-forest-foreground/10 hover:text-forest-foreground" />
          <button
            type="button"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-forest-foreground/10 focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none md:hidden"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
        <Link
          href={cta.href}
          aria-label={cta.label}
          title={cta.label}
          className="group flex w-16 items-center justify-center bg-lime text-lime-foreground transition-colors hover:bg-lime/85 focus-visible:ring-3 focus-visible:ring-forest-foreground/60 focus-visible:outline-none sm:w-20"
        >
          <ArrowUpRight className="size-5 transition-transform duration-500 ease-(--ease-soft) group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </Link>
      </div>

      {open && (
        <nav id="landing-mobile-nav" aria-label="Điều hướng di động" className="border-t border-forest-foreground/15 px-5 pt-2 pb-5 md:hidden">
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block border-b border-forest-foreground/10 py-3.5 text-sm tracking-[0.12em] uppercase">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-medium">
            {!signedIn && (
              <Link href="/login" className="flex h-11 items-center justify-center border border-forest-foreground/30">
                Đăng nhập
              </Link>
            )}
            <Link href={cta.href} className={cn("flex h-11 items-center justify-center bg-lime text-lime-foreground", signedIn && "col-span-2")}>
              {cta.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
