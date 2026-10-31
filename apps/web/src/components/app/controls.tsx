"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SearchBox({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full bg-muted pr-10 pl-11 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Xoá tìm kiếm" className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full hover:bg-border">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Native select (best on tablets/phones) styled as a pill, with a visible label. */
export function SelectField({ label, hideLabel, error, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hideLabel?: boolean; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("mb-1.5 block text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(
            "h-12 w-full cursor-pointer appearance-none rounded-full border bg-card pr-10 pl-5 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            error ? "border-destructive" : "border-input",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 px-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Pill segmented control, keyboard-operable as a radio group. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-full bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 cursor-pointer rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            value === o.value ? "bg-lime font-medium text-lime-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const btn = "flex size-10 cursor-pointer items-center justify-center rounded-full bg-muted hover:bg-border disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-between gap-3 pt-4 text-sm">
      <p className="text-muted-foreground tabular">
        {formatNumber(from)}–{formatNumber(to)} trong {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-16 text-center tabular">
          {page} / {pages}
        </span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
