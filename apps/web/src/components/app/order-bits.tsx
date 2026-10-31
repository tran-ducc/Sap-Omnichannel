import type { ChannelType, OrderStatus, PaymentStatus, PersonRef } from "@omni/shared";
import { CHANNEL_META, ORDER_STATUS, PAYMENT_STATUS, TONE_CLASS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Avatar } from "./app-shell";

export function ChannelTag({ channel, className }: { channel: ChannelType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: CHANNEL_META[channel].color }} aria-hidden />
      {CHANNEL_META[channel].label}
    </span>
  );
}

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const s = ORDER_STATUS[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", TONE_CLASS[s.tone], className)}>{s.label}</span>;
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs whitespace-nowrap", s.tone === "done" ? "bg-muted" : TONE_CLASS[s.tone])}>{s.label}</span>;
}

export function PersonChip({ person, empty = "Chưa phân công" }: { person: PersonRef | null; empty?: string }) {
  if (!person) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Avatar name={person.fullName} url={person.avatarUrl} className="size-7 text-[10px]" />
      <span className="text-sm">{person.fullName}</span>
    </span>
  );
}
