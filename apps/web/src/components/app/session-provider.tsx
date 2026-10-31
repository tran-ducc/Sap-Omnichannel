"use client";

import type { AuthSession, Permission } from "@omni/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onRefresh, refreshSession, setAccessToken } from "@/lib/api";

type Status = "loading" | "authenticated" | "anonymous";

interface SessionContextValue {
  status: Status;
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<AuthSession>;
  register: (input: { shopName: string; fullName: string; email: string; password: string; phone?: string }) => Promise<AuthSession>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Restores the session on first load by exchanging the httpOnly refresh
 * cookie for a fresh access token, and keeps it current after 401 retries.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const apply = useCallback((s: AuthSession | null) => {
    setAccessToken(s?.accessToken ?? null);
    setSession(s);
    setStatus(s ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    onRefresh(apply);
    refreshSession().then(apply);
    return () => onRefresh(null);
  }, [apply]);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await api<AuthSession>("/auth/login", { method: "POST", json: { email, password } });
      apply(s);
      return s;
    },
    [apply],
  );

  const register = useCallback<SessionContextValue["register"]>(
    async (input) => {
      const s = await api<AuthSession>("/auth/register", { method: "POST", json: input });
      apply(s);
      return s;
    },
    [apply],
  );

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    apply(null);
  }, [apply]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, login, register, logout, can: (p) => !!session?.permissions.includes(p) }),
    [status, session, login, register, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
