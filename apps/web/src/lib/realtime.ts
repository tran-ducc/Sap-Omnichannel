"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken, refreshSession } from "./api";

/**
 * One Socket.io connection per tab to the API's /realtime namespace. The
 * access token is read at (re)connect time; when the server rejects it as
 * expired we refresh the session once and reconnect.
 */
let socket: Socket | null = null;
let refreshTries = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function getSocket(): Socket {
  if (socket) return socket;
  // Socket.io connects to the API directly (the /api/v1 rewrite does not carry WebSockets);
  // it authenticates with the access token, not the cookie, so cross-site is fine.
  const origin = process.env.NEXT_PUBLIC_REALTIME_URL ?? new URL(API_URL, window.location.origin).origin;
  socket = io(`${origin}/realtime`, {
    autoConnect: false,
    transports: ["websocket"],
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  socket.on("connect", () => {
    refreshTries = 0;
    notify();
  });
  socket.on("disconnect", notify);
  socket.on("connect_error", async (err) => {
    notify();
    if (err.message === "unauthorized" && refreshTries < 2) {
      refreshTries++;
      if (await refreshSession()) socket?.connect();
    }
  });
  return socket;
}

export function connectRealtime() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectRealtime() {
  socket?.disconnect();
}

/** For useSyncExternalStore: current connection state. */
export function subscribeConnection(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const isRealtimeConnected = () => !!socket?.connected;
