import { useSyncExternalStore } from "react";

/**
 * Which of the three sites this page is being served as.
 *
 * loopdn.com is chat. commercial.loopdn.com is the commercial dashboard, for
 * companies that buy ads. admin.loopdn.com is Loopd'n's own admin tools. They
 * are the same build, told apart by hostname, so commercial.localhost and
 * admin.localhost work in development with nothing to configure beyond
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

/** The admin site, admin.loopdn.com - see isCommercialSite for the rules. */
export function isAdminSite(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.startsWith("admin.")
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

/** The same for the admin site: false on the server and during hydration. */
export function useIsAdminSite(): boolean {
  return useSyncExternalStore(subscribeToNothing, isAdminSite, () => false);
}

function subscribeToNothing(): () => void {
  // The hostname never changes while a page is open.
  return () => {};
}

/**
 * Where a signed-in person belongs when nothing more specific was asked for:
 * the dashboard, which is the root of the commercial site; the admin site's
 * overview; or chats.
 */
export function homePath(): string {
  if (isCommercialSite()) return "/";
  if (isAdminSite()) return "/admin/";
  return "/chats/";
}

/** The bare hostname the three sites share: loopdn.com, or localhost. */
function baseHost(): string {
  return window.location.hostname.replace(/^(commercial|admin)\./, "");
}

function siteUrl(prefix: string, path: string): string {
  const { protocol, port } = window.location;
  return `${protocol}//${prefix}${baseHost()}${port ? `:${port}` : ""}${path}`;
}

/**
 * The commercial site's address, from wherever this page is:
 * loopdn.com -> commercial.loopdn.com, localhost:3002 -> commercial.localhost:3002.
 */
export function commercialSiteUrl(path = "/"): string {
  return siteUrl("commercial.", path);
}

/**
 * The chat site's address, from either of the others:
 * commercial.loopdn.com -> loopdn.com, admin.localhost:3002 -> localhost:3002.
 */
export function chatSiteUrl(path = "/"): string {
  return siteUrl("", path);
}

/**
 * The admin site's address, from wherever this page is:
 * loopdn.com -> admin.loopdn.com, localhost:3002 -> admin.localhost:3002.
 */
export function adminSiteUrl(path = "/admin/"): string {
  return siteUrl("admin.", path);
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

/** Pages the chat and commercial sites share: signing in, and the legal pages. */
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

/**
 * Every admin page is under /admin/. One prefix rather than names of their
 * own, because the three sites share one build and so one set of addresses:
 * /campaigns/ is already commercial's and /settings/ chat's.
 */
export const ADMIN_PATH_PREFIX = "/admin/";

/**
 * What the admin site shares with the others: signing in, and the legal
 * pages. Not signing UP - an admin account is an ordinary account that has
 * been given the admin role, never one made here - and not adding a phone.
 */
export const ADMIN_SHARED_PATHS = [
  "/login/",
  "/verify-email/",
  "/verify-phone/",
  "/forgot-password/",
  "/reset-password/",
  "/privacy/",
  "/terms/",
];

/** Whether a path is one of the admin site's own pages. */
export function isAdminPath(pathname: string): boolean {
  return withSlash(pathname).startsWith(ADMIN_PATH_PREFIX);
}

/** Whether a path may be visited on the admin site. */
export function belongsOnAdminSite(pathname: string): boolean {
  const path = withSlash(pathname);
  return (
    isAdminPath(path) ||
    ADMIN_SHARED_PATHS.some((page) => path.startsWith(page))
  );
}
