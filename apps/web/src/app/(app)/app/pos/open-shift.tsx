"use client";

import type { LocationSummary, PosShift } from "@omni/shared";
import { Loader2, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/app/controls";
import { FormField } from "@/components/app/form-field";
import { useSession } from "@/components/app/session-provider";
import { InlineError } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK = [500_000, 1_000_000, 2_000_000];

/** Start of a cashier's shift: pick the store and count the opening float. */
export function OpenShift({ onOpened }: { onOpened: (s: PosShift) => void }) {
  const { inScope } = useSession();
  // /locations is already limited to the staff member's branches; inScope is a second guard.
  const { data: locations = [] } = useApiQuery<LocationSummary[]>("/locations");
  const stores = locations.filter((l) => l.type === "STORE" && inScope(l.id));
  const [picked, setPicked] = useState("");
  const locationId = picked || stores[0]?.id || "";
  const [cash, setCash] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      onOpened(await api<PosShift>("/pos/shifts", { method: "POST", json: { locationId, openingCash: Number(cash || 0) } }));
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-[70dvh] place-items-center">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-card p-6 sm:p-8" noValidate>
        <span className="flex size-14 items-center justify-center rounded-full bg-lime text-lime-foreground">
          <Store className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-normal tracking-[-0.03em]">Mở ca bán hàng</h1>
          <p className="mt-1 text-sm text-muted-foreground">Đếm tiền mặt trong két trước khi bắt đầu. Cuối ca hệ thống sẽ đối chiếu giúp bạn.</p>
        </div>
        {error && <InlineError message={error} />}
        {stores.length === 0 && locations.length > 0 ? (
          <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">Bạn chưa được phân công cửa hàng nào. Liên hệ Quản lý để được thêm.</p>
        ) : (
          <SelectField label="Cửa hàng" value={locationId} onChange={(e) => setPicked(e.target.value)}>
            {stores.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        )}
        <div>
          <FormField
            label="Tiền mặt đầu ca"
            inputMode="numeric"
            value={cash ? formatNumber(Number(cash)) : ""}
            onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            hint="Số tiền lẻ để thối cho khách."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((v) => (
              <button key={v} type="button" onClick={() => setCash(String(v))} className={cn("h-9 cursor-pointer rounded-full px-3.5 text-sm tabular", Number(cash) === v ? "bg-lime text-lime-foreground" : "bg-muted hover:bg-border")}>
                {formatNumber(v)}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={pending || !locationId} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Mở ca và bắt đầu bán
        </button>
      </form>
    </div>
  );
}
