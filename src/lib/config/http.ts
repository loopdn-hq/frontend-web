/**
 * The fetch the app uses, behind one swappable reference.
 *
 * The desktop build may one day route requests through Rust rather than the
 * webview (see the desktop plan, "HTTP transport"). It does not today, and
 * native fetch is the right default on both targets - but every call site
 * importing the global directly would make that a 19-file change instead of a
 * one-line one. The indirection costs nothing and buys the option.
 */
type FetchFn = typeof globalThis.fetch;

let impl: FetchFn = (...args) => globalThis.fetch(...args);

/** Replace the implementation. Called once at startup, by the desktop entry only. */
export function setHttp(next: FetchFn): void {
  impl = next;
}

export const http: FetchFn = (...args) => impl(...args);
