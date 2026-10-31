import type { ChannelListingState } from "@omni/shared";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { CHANNEL_META } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Compact marketplace sync indicator. Status is carried by icon + text,
 * channel identity by its dot + name (in the title / list), never colour alone.
 */
export function SyncStatus({ listings, detailed }: { listings: ChannelListingState[]; detailed?: boolean }) {
  if (!listings.length) return <span className="text-xs text-muted-foreground">Chưa lên sàn</span>;
  const failed = listings.filter((l) => l.syncStatus === "FAILED");
  const pending = listings.filter((l) => l.syncStatus === "PENDING");
  const summary = failed.length
    ? `Lỗi ${failed.length}/${listings.length} kênh`
    : pending.length
      ? `Đang đồng bộ ${listings.length - pending.length}/${listings.length}`
      : `Đã khớp ${listings.length} kênh`;
  const title = listings.map((l) => `${CHANNEL_META[l.channelType].label}: ${l.syncStatus === "SYNCED" ? "đã khớp" : l.syncStatus === "PENDING" ? "đang đồng bộ" : `lỗi${l.lastError ? ` (${l.lastError})` : ""}`}`).join("\n");

  return (
    <div className="flex flex-col gap-1.5" title={detailed ? undefined : title}>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
          failed.length ? "bg-destructive/10 text-destructive" : pending.length ? "bg-amber-soft text-amber-ink" : "bg-muted text-foreground",
        )}
      >
        {failed.length ? <AlertCircle className="size-3.5" aria-hidden /> : pending.length ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
        {summary}
      </span>
      {detailed && (
        <ul className="flex flex-wrap gap-1.5">
          {listings.map((l) => (
            <li key={l.channelType} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
              <span className="size-1.5 rounded-full" style={{ background: CHANNEL_META[l.channelType].color }} aria-hidden />
              {CHANNEL_META[l.channelType].label}
              {l.syncStatus === "PENDING" && <Loader2 className="size-3 animate-spin" aria-label="đang đồng bộ" />}
              {l.syncStatus === "FAILED" && <AlertCircle className="size-3 text-destructive" aria-label="lỗi đồng bộ" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
