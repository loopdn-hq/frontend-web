import { useSyncExternalStore } from "react";

/**
 * Which of the two sites this page is being served as.
 *
 * loopdn.com is chat. commercial.loopdn.com is the commercial dashboard, for
 * companies that buy ads. They are the same build, told apart by hostname, so
 * commercial.localhost works in development with nothing to configure beyond
 * `allowedDevOrigins` in next.config.ts.
 *
 * Checked at call time, never at module scope, like `isDesktop()`: a static
 * export is rendered once at build time with no hostname at all, so anything
 * that differs by site has to be decided in the browser.
 */
export function isCommercialSite(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.startsWith("commercial.")
  );
}

/**
 * The same answer for rendering. False on the server and during hydration, so
 * the first client render matches the exported HTML, then the real answer.
 */
export function useIsCommercialSite(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    isCommercialSite,
    () => false,
  );
}

function subscribeToNothing(): () => void {
  // The hostname never changes while a page is open.
  return () => {};
}

/**
 * Where a signed-in person belongs when nothing more specific was asked for:
 * the dashboard, which is the root of the commercial site, or chats.
 */
export function homePath(): string {
  return isCommercialSite() ? "/" : "/chats/";
}

/**
 * The commercial site's address, from wherever this page is:
 * loopdn.com -> commercial.loopdn.com, localhost:3002 -> commercial.localhost:3002.
 */
export function commercialSiteUrl(path = "/"): string {
  const { protocol, hostname, port } = window.location;
  const host = isCommercialSite() ? hostname : `commercial.${hostname}`;
  return `${protocol}//${host}${port ? `:${port}` : ""}${path}`;
}

/**
 * The chat site's address, from the commercial one:
 * commercial.loopdn.com -> loopdn.com, commercial.localhost:3002 -> localhost:3002.
 */
export function chatSiteUrl(path = "/"): string {
  const { protocol, hostname, port } = window.location;
  const host = hostname.replace(/^commercial\./, "");
  return `${protocol}//${host}${port ? `:${port}` : ""}${path}`;
}

/**
 * The dashboard's own pages. `/` is the dashboard too, on the commercial site,
 * and is matched separately because every path starts with it. Ends in "/"
 * because the export uses trailingSlash.
 */
export const COMMERCIAL_DASHBOARD_PATHS = [
  "/campaigns/",
  "/campaign/",
  "/leads/",
  "/reports/",
  "/balance/",
  "/company/",
  "/account/",
];

/** Pages both sites share: signing in, and the legal pages. */
export const SHARED_SITE_PATHS = [
  "/login/",
  "/signup/",
  "/verify-email/",
  "/verify-phone/",
  "/add-phone/",
  "/forgot-password/",
  "/reset-password/",
  "/privacy/",
  "/terms/",
];

function withSlash(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/** Whether a path is one of the dashboard's pages (not counting `/`). */
export function isCommercialDashboardPath(pathname: string): boolean {
  const path = withSlash(pathname);
  return COMMERCIAL_DASHBOARD_PATHS.some((page) => path.startsWith(page));
}

/** Whether a path may be visited on the commercial site. */
export function belongsOnCommercialSite(pathname: string): boolean {
  const path = withSlash(pathname);
  return (
    path === "/" ||
    isCommercialDashboardPath(path) ||
    SHARED_SITE_PATHS.some((page) => path.startsWith(page))
  );
}
