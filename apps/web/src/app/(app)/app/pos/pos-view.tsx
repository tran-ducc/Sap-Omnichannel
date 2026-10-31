"use client";

import type { PosShift } from "@omni/shared";
import { ErrorState, RowsSkeleton } from "@/components/app/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { OpenShift } from "./open-shift";
import { Register } from "./register";

/** POS entry: no open shift → open one; otherwise the selling screen. */
export function PosView() {
  const { data, error, loading, reload, mutate } = useApiQuery<PosShift | null>("/pos/shifts/current");
  if (error && data === undefined) return <ErrorState message={error.message} onRetry={reload} />;
  if (data === undefined || (loading && !data)) return <RowsSkeleton rows={6} className="rounded-3xl bg-card p-4" />;
  if (!data) return <OpenShift onOpened={(s) => mutate(() => s)} />;
  return <Register key={data.id} shift={data} onShiftChange={(s) => mutate(() => s)} onShiftClosed={reload} />;
}
