import { cn } from "@/lib/utils";

/** "01 / TÍNH NĂNG" section marker: small uppercase label over a hairline. */
export function SectionLabel({ index, children, className }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 border-t border-current/20 pt-3 text-xs font-medium tracking-[0.14em] uppercase", className)}>
      <span className="tabular opacity-60">{index}</span>
      {children}
    </p>
  );
}

/** Thin crosshair frame with concentric rings, the reference's "lens" around the hero object. */
export function LensFrame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn("pointer-events-none", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="199" height="199" className="fill-none stroke-current" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".45" />
      <path d="M100 0v200M0 100h200" className="stroke-current" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".18" />
      {[46, 70, 94].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} className="fill-none stroke-current" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".22" />
      ))}
    </svg>
  );
}

/** Big round accent button ("EXPLORE" in the reference). */
export function RoundCta({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "flex size-28 items-center justify-center rounded-full bg-lime text-center text-xs font-semibold tracking-[0.14em] text-lime-foreground uppercase transition-transform duration-500 ease-(--ease-soft) hover:scale-105 focus-visible:ring-4 focus-visible:ring-lime/40 focus-visible:outline-none sm:size-32",
        className,
      )}
    >
      {children}
    </a>
  );
}
