"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";

interface QueryState<T> {
  key: string;
  data?: T;
  error?: ApiRequestError;
}

/**
 * Minimal GET hook. Loading is derived (the settled key differs from the
 * requested one) instead of set inside the effect, and the previous data is
 * kept while a new query loads so the layout does not jump.
 * `mutate` patches the cached data in place (used for realtime updates and
 * optimistic edits). Pass `null` as path to skip fetching.
 */
export function useApiQuery<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = `${path}#${nonce}`;
  const [state, setState] = useState<QueryState<T>>({ key: "" });

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ key, data }))
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({ key, data: s.data, error: e instanceof ApiRequestError ? e : undefined }));
      });
    return () => ctrl.abort();
  }, [path, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback((update: (data: T) => T) => setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) })), []);
  const settled = !path || state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : undefined,
    loading: !settled,
    reload,
    mutate,
  };
}
