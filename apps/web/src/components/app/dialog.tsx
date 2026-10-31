"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** "center" for forms, "side" for history panels. */
  variant?: "center" | "side";
  className?: string;
}

/**
 * Modal built on the native <dialog>: the browser handles focus trapping,
 * Escape and the top layer. Focus returns to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = "center", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault(); // let React own the open state
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className={cn(
        "m-auto max-h-[min(90dvh,860px)] w-[min(100%-1.5rem,32rem)] overflow-visible bg-transparent p-0 text-foreground backdrop:bg-night/50 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in open:zoom-in-95",
        variant === "side" && "mr-3 h-[calc(100dvh-1.5rem)] max-h-none w-[min(100%-1.5rem,30rem)] open:slide-in-from-right-8 open:zoom-in-100",
        className,
      )}
    >
      <div className={cn("flex max-h-[inherit] flex-col rounded-3xl bg-card", variant === "side" && "h-full")}>
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-normal tracking-[-0.02em]">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{open && children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}
