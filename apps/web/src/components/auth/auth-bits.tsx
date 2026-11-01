import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title whose words light up one after another (muted → bright), as in
 * the reference clip. The full sentence is in the DOM from the start, so
 * screen readers and no-motion users get it as one heading.
 */
export function AuthHeadline({ children, sub }: { children: string; sub?: string }) {
  const words = children.split(" ");
  return (
    <div>
      <h1 className="text-[clamp(2rem,3vw,2.6rem)] leading-[1.08] font-normal tracking-[-0.035em] text-forest-foreground">
        {words.map((w, i) => (
          <span key={i} className="auth-word" style={{ "--w": i } as CSSProperties}>
            {w}
            {i < words.length - 1 && " "}
          </span>
        ))}
      </h1>
      {sub && <p className="auth-rise mt-3 text-[15px] font-light text-forest-foreground/60 [--rise-delay:300ms]">{sub}</p>}
    </div>
  );
}

/** Bordered strip below the form: "Đã có tài khoản? [Đăng nhập]". */
export function AuthSwitch({ prompt, href, action, className }: { prompt: string; href: string; action: string; className?: string }) {
  return (
    <div className={cn("auth-rise flex items-center justify-between gap-3 rounded-2xl border border-forest-foreground/15 px-4 py-3 text-sm [--rise-delay:750ms]", className)}>
      <span className="text-forest-foreground/70">{prompt}</span>
      <Link
        href={href}
        className="shrink-0 rounded-lg border border-forest-foreground/25 px-3 py-1.5 text-sm font-medium text-forest-foreground transition-colors hover:border-lime hover:text-lime focus-visible:ring-3 focus-visible:ring-lime/40 focus-visible:outline-none"
      >
        {action}
      </Link>
    </div>
  );
}
