import { PUBLIC_ORIGIN } from "./env";

/**
 * True when running inside the Tauri desktop shell.
 *
 * Checked at call time rather than module scope: the Tauri runtime injects
 * this during page setup, and a module evaluated during prerendering would
 * capture the answer before it exists.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * The origin to use for URLs that leave the app.
 *
 * On the web this is the page's own origin. In the desktop build the page
 * origin is tauri://localhost, so the build-time public origin is used
 * instead - Stripe refuses a custom-scheme return URL, and an invite link
 * nobody can open is worse than no link.
 */
export function publicOrigin(): string {
  if (PUBLIC_ORIGIN) return PUBLIC_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
