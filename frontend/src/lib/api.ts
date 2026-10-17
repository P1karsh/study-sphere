// Small wrapper around fetch for talking to the StudySphere backend.
//
// In development Vite proxies /api to the FastAPI server (see vite.config.ts),
// so the browser sees one origin and the session cookie just works. Set
// VITE_API_URL if the API lives somewhere else.
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Called whenever a request comes back 401, so the app can drop a session
// that expired while the page was open.
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiRequest<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach StudySphere right now. Check your connection and try again.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    if (typeof data?.detail === "string") {
      throw new ApiError(response.status, data.detail);
    }
    if (response.status >= 500) {
      throw new ApiError(response.status, "The server isn't responding. Please try again in a moment.");
    }
    throw new ApiError(response.status, "Something went wrong. Please try again.");
  }

  return data as T;
}
