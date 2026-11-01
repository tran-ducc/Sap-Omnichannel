import { cn } from "@/lib/utils";

/**
 * SapOmni mark: a market-stall house (sạp) with a scalloped lime awning over a
 * stockroom door stacked with parcels. Drawn from the brand artwork; colours
 * are fixed so the mark reads the same on light and dark backgrounds.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      {/* Building: two roof faces, left lighter */}
      <path d="M6 24.5a4 4 0 0 1 2.3-3.6L32 8l23.7 12.9a4 4 0 0 1 2.3 3.6V55a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#2f4a1c" />
      <path d="M32 8l23.7 12.9a4 4 0 0 1 2.3 3.6V55a4 4 0 0 1-4 4H32Z" fill="#253b16" />
      {/* Scalloped awning following the roof line */}
      <path
        d="M6 22.6L32 11.6L58 22.6L58 27.6Q53.7 29.4 49.3 23.9Q45 25.7 40.7 20.3Q36.3 22 32 16.6Q27.7 22 23.3 20.3Q19 25.7 14.7 23.9Q10.3 29.4 6 27.6Z"
        fill="#d9f35a"
      />
      {/* Doorway */}
      <path d="M17.5 59V37.2L32 29.8l14.5 7.4V59Z" fill="#f7f8f1" />
      {/* Parcels */}
      <rect x="26.6" y="38.4" width="10.8" height="9.2" rx="0.6" fill="#6e8a2b" />
      <rect x="20.6" y="48.6" width="10.8" height="10.4" rx="0.6" fill="#6e8a2b" />
      <rect x="32.6" y="48.6" width="10.8" height="10.4" rx="0.6" fill="#55701f" />
      <path d="M32 38.4v3.2M26 48.6v3M38 48.6v3" stroke="#3a4f17" strokeWidth="1" />
    </svg>
  );
}

/** Mark + "SapOmni" wordmark. `onDark` keeps "Sap" light on always-dark surfaces (landing hero, footer). */
export function Logo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[21px] leading-none font-semibold tracking-tight">
        <span className={onDark ? "text-forest-foreground" : "text-brand-sap"}>Sap</span>
        <span className={onDark ? "text-lime" : "text-brand-omni"}>Omni</span>
      </span>
    </span>
  );
}
