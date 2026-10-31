import { cn } from "@/lib/utils";

/** Mark: a market-stall awning (sạp) over a counter. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="10" className="fill-ink" />
      <path
        d="M7 11.5h18l-1.2 3.3a2.3 2.3 0 0 1-4.3 0 2.3 2.3 0 0 1-4.3 0 2.3 2.3 0 0 1-4.3 0 2.3 2.3 0 0 1-2.7 1.3Z"
        className="fill-lime dark:fill-ink-foreground"
      />
      <path d="M9 8.5h14l2 3H7z" className="fill-lime dark:fill-ink-foreground" opacity=".7" />
      <rect x="9" y="18" width="14" height="6.5" rx="1.6" className="fill-ink-foreground" opacity=".9" />
      <rect x="14.2" y="20.2" width="3.6" height="4.3" rx=".8" className="fill-ink" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[22px] leading-none font-semibold tracking-tight text-foreground">Sạp</span>
    </span>
  );
}
