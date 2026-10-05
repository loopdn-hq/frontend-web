import { vi } from "vitest";

/**
 * Shared by tests only. Nothing under src/test is shipped or counted towards
 * coverage.
 */

/**
 * Serve the page from somewhere else for one test.
 *
 * jsdom's own location cannot be given a different hostname, and which of the
 * three sites this is depends on nothing else. Undone by `vi.unstubAllGlobals()`.
 */
export function stubLocation(href: string) {
  const url = new URL(href);
  const location = {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    toString: () => url.href,
  };
  vi.stubGlobal("location", location);
  return location;
}

/** A response as `authorizedRequest` and `http` hand one back. */
export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/** A response whose body is not JSON at all - a proxy's error page, say. */
export function brokenResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
    text: async () => "<html>",
  } as unknown as Response;
}

/**
 * jsdom has no matchMedia. Answers `matches` for every query, and returns the
 * listeners so a test can fire a change (the system theme flipping, say).
 */
export function stubMatchMedia(
  matches: boolean | ((query: string) => boolean),
) {
  const listeners = new Set<() => void>();
  const state = { matches };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return typeof state.matches === "function"
          ? state.matches(query)
          : state.matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  );
  return {
    listeners,
    /** Change the answer and tell whoever is listening. */
    set(next: boolean) {
      state.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/** A request that stays out until the test answers it. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
