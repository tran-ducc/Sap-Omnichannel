import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl bg-muted/60 px-6 py-14 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-card">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-normal tracking-[-0.01em]">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Không tải được dữ liệu", message, onRetry, className }: { title?: string; message: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-3xl bg-board px-6 py-14 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-soft text-amber-ink">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-normal">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} className={cn(buttonVariants({ size: "md" }), "mt-5")}>
        <RotateCw className="size-4" aria-hidden />
        Thử lại
      </button>
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export function RowsSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-full bg-muted" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
