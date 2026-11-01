"use client";

import { MAX_PRODUCT_IMAGES } from "@omni/shared";
import { Loader2, Plus, X } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export const productInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/**
 * Product photo that falls back to the name's initials when there is no URL
 * or the image fails to load (dead link, blocked host). Photos come from
 * pasted URLs on any host, so a plain <img> is used instead of next/image.
 */
export function ProductThumb({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) {
    return (
      <span className={cn("flex size-full items-center justify-center", className)} aria-hidden>
        {productInitials(name)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- pasted URLs on any host
  return <img src={src} alt="" onError={() => setBroken(src)} className={cn("size-full object-cover", className)} />;
}

/** Client-side check mirroring the API: absolute http(s) URL. */
function urlError(value: string, existing: string[]): string | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "Dán một đường dẫn đầy đủ, ví dụ https://…/anh.jpg";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Chỉ nhận đường dẫn http:// hoặc https://";
  if (existing.includes(value)) return "Ảnh này đã có trong danh sách";
  return null;
}

/**
 * Edit a product's photo URLs: paste to add, × to remove, first one is the cover.
 * `onChange` may be async (detail page saves right away); errors it throws are shown inline.
 */
export function ImageUrlsField({
  name,
  value,
  onChange,
  disabled,
  error: externalError,
}: {
  name: string;
  value: string[];
  onChange: (next: string[]) => void | Promise<void>;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const full = value.length >= MAX_PRODUCT_IMAGES;

  async function commit(next: string[]) {
    setBusy(true);
    setError("");
    try {
      await onChange(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e?: FormEvent | KeyboardEvent) {
    e?.preventDefault();
    const url = draft.trim();
    if (!url) return;
    const problem = urlError(url, value);
    if (problem) return setError(problem);
    if (await commit([...value, url])) setDraft("");
  }

  const shownError = error || externalError;
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Ảnh sản phẩm">
          {value.map((url, i) => (
            <li key={url} className="relative size-20 overflow-hidden rounded-2xl bg-muted text-lg font-light">
              <ProductThumb src={url} name={name || "?"} />
              {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-medium">Ảnh bìa</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => commit(value.filter((u) => u !== url))}
                  disabled={busy}
                  aria-label={`Xoá ảnh ${i + 1}`}
                  className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-night/70 text-night-foreground hover:bg-night disabled:opacity-50"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <label htmlFor={id} className="sr-only">
            Đường dẫn ảnh
          </label>
          <input
            id={id}
            type="url"
            inputMode="url"
            value={draft}
            onChange={(e) => (setDraft(e.target.value), setError(""))}
            onKeyDown={(e) => e.key === "Enter" && add(e)}
            disabled={full || busy}
            placeholder={full ? `Đã đủ ${MAX_PRODUCT_IMAGES} ảnh` : "Dán đường dẫn ảnh https://…"}
            aria-invalid={!!shownError || undefined}
            aria-describedby={`${id}-hint`}
            className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => add()}
            disabled={full || busy || !draft.trim()}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Thêm ảnh
          </button>
        </div>
      )}
      <p id={`${id}-hint`} className={cn("mt-1.5 px-1 text-xs", shownError ? "font-medium text-destructive" : "text-muted-foreground")} role={shownError ? "alert" : undefined}>
        {shownError || `${value.length}/${MAX_PRODUCT_IMAGES} ảnh. Ảnh đầu tiên là ảnh bìa. Chưa hỗ trợ tải file lên.`}
      </p>
    </div>
  );
}
