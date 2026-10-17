import { vi } from "vitest";

// A tiny stand-in for the backend. Each test says how each endpoint should
// answer, and we swap it in for window.fetch.

type Reply =
  | { status: number; body?: unknown }
  | "network-error"
  | Promise<{ status: number; body?: unknown }>;

type Routes = Record<string, Reply | (() => Reply)>;

export const ada = {
  id: 1,
  name: "Ada Lovelace",
  email: "ada@example.com",
  created_at: "2026-10-17T12:00:00Z",
};

export function fakeApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const route = routes[key];
    if (route === undefined) {
      throw new Error(`No fake response for ${key}`);
    }

    const reply = await (typeof route === "function" ? route() : route);
    if (reply === "network-error") {
      throw new TypeError("Failed to fetch");
    }

    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function callsTo(fetchMock: ReturnType<typeof fakeApi>, method: string, url: string) {
  return fetchMock.mock.calls.filter(
    ([input, init]) => String(input) === url && (init?.method ?? "GET") === method,
  );
}

// A promise you resolve by hand, for holding a request "in flight".
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
