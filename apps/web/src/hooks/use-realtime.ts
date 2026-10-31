"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getSocket, isRealtimeConnected, subscribeConnection } from "@/lib/realtime";

/** Subscribe to a realtime event for the lifetime of the component. */
export function useRealtime<T>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const s = getSocket();
    const fn = (payload: T) => ref.current(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

export function useRealtimeStatus() {
  return useSyncExternalStore(subscribeConnection, isRealtimeConnected, () => false);
}
