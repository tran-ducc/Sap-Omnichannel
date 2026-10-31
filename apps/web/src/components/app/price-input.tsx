"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const parse = (s: string) => Number(s.replace(/\D/g, ""));

/**
 * Inline VND price editor: shows "1.250.000", saves on Enter or blur when the
 * value changed, Escape reverts. Reports status next to the field.
 */
export function PriceInput({ value, label, onSave }: { value: number; label: string; onSave: (v: number) => Promise<void> }) {
  const [draft, setDraft] = useState(formatNumber(value));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  // Follow the server value when it changes from elsewhere (and we're not editing).
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setDraft(formatNumber(value));
  }

  async function commit() {
    const next = parse(draft);
    if (!draft.trim() || next === value) {
      setDraft(formatNumber(value));
      return;
    }
    setState("saving");
    try {
      await onSave(next);
      setState("saved");
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      setState("error");
      setError((e as Error).message);
      setDraft(formatNumber(value));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input
          aria-label={label}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(formatNumber(parse(e.target.value)))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(formatNumber(value));
              e.currentTarget.blur();
            }
          }}
          aria-invalid={state === "error" || undefined}
          className={cn(
            "h-10 w-32 rounded-full border bg-card pr-7 pl-3 text-right text-sm tabular outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            state === "error" ? "border-destructive" : "border-input",
          )}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">₫</span>
      </div>
      <span className="w-4" aria-live="polite">
        {state === "saving" && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Đang lưu" />}
        {state === "saved" && <Check className="size-4 text-success" aria-label="Đã lưu" />}
      </span>
      {state === "error" && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
}
