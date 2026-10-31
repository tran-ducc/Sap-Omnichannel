import type { ApiError, AuthSession } from "@omni/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Error thrown for any non-2xx response, carrying the API's error body. */
export class ApiRequestError extends Error {
  constructor(public readonly body: ApiError) {
    super(body.message);
  }
  get status() {
    return this.body.statusCode;
  }
  /** Message for a given form field, if the API reported one. */
  field(name: string) {
    return this.body.details?.find((d) => d.field === name)?.message;
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let onSessionRefreshed: ((s: AuthSession | null) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
/** Lets the session provider hear about refreshes triggered by a 401 retry. */
export function onRefresh(cb: typeof onSessionRefreshed) {
  onSessionRefreshed = cb;
}

// Single-flight: concurrent 401s share one refresh call (the token rotates,
// so two parallel refreshes would trip the server's reuse detection).
let refreshing: Promise<AuthSession | null> | null = null;
export function refreshSession(): Promise<AuthSession | null> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => (res.ok ? ((await res.json()) as AuthSession) : null))
    .catch(() => null)
    .then((session) => {
      accessToken = session?.accessToken ?? null;
      onSessionRefreshed?.(session);
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function toError(res: Response): Promise<ApiRequestError> {
  try {
    return new ApiRequestError((await res.json()) as ApiError);
  } catch {
    return new ApiRequestError({ statusCode: res.status, error: "HttpError", message: "Không kết nối được máy chủ. Vui lòng thử lại." });
  }
}

/**
 * fetch wrapper: JSON in/out, Bearer token, cookies, one transparent retry
 * after refreshing an expired access token.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retried = false): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        ...(json !== undefined && { "content-type": "application/json" }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiRequestError({ statusCode: 0, error: "NetworkError", message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." });
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const session = await refreshSession();
    if (session) return api<T>(path, init, true);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  // A handler returning null is sent as an empty 200 body.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
