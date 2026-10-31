import { cn } from "@/lib/utils";

/** Four-point star used as a node on connector lines (landing reference). */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 fill-foreground", className)} aria-hidden>
      <path d="M8 0c.5 4.2 3.8 7.5 8 8-4.2.5-7.5 3.8-8 8-.5-4.2-3.8-7.5-8-8 4.2-.5 7.5-3.8 8-8Z" />
    </svg>
  );
}

/** Line-art stack of parcels — the retail stand-in for the reference's coin stack. */
export function ParcelStack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={cn("h-16 w-14 fill-none stroke-foreground", className)} strokeWidth="1.3" aria-hidden>
      {[0, 22, 44].map((y) => (
        <g key={y} transform={`translate(0 ${y})`}>
          <path d="M8 10 32 2l24 8-24 8Z" />
          <path d="M8 10v10l24 8 24-8V10" />
          <path d="M32 18v10M20 6l24 8" />
        </g>
      ))}
    </svg>
  );
}

// Alternating bar/gap widths, laid out once at module load.
const BAR_WIDTHS = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2];
const BARS = BAR_WIDTHS.reduce<{ x: number; w: number }[]>((acc, w, i) => {
  const x = i === 0 ? 0 : acc.length && i % 2 === 0 ? acc[acc.length - 1].x + acc[acc.length - 1].w + BAR_WIDTHS[i - 1] * 1.2 : 0;
  return i % 2 === 0 ? [...acc, { x: i === 0 ? 0 : x, w }] : acc;
}, []);
const BARCODE_WIDTH = BARS[BARS.length - 1].x + BARS[BARS.length - 1].w;

/** Barcode strip for the receipt/ticket cards. */
export function Barcode({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${BARCODE_WIDTH} 40`} preserveAspectRatio="none" className={cn("h-10 w-full fill-foreground", className)} aria-hidden>
      {BARS.map((b) => (
        <rect key={b.x} x={b.x} y="0" width={b.w} height="40" />
      ))}
    </svg>
  );
}
