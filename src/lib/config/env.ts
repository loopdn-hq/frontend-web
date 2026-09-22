/**
 * Build-time configuration, in one place.
 *
 * Every value here is inlined by Next at build time - a static export has no
 * runtime to read an environment variable from. That is why these are read
 * once here rather than at each call site: a bundle built with the wrong value
 * is wrong everywhere, and finding that out from one module is easier than
 * from four.
 */

/**
 * Where the API lives. Was previously re-declared in four modules, each
 * defaulting to "" - which in a desktop bundle silently produces relative URLs
 * against tauri://localhost and fails in a way that looks like a network
 * problem rather than a missing build variable.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * The public web origin, for URLs that LEAVE the app: Stripe return URLs,
 * invite links, anything a person might paste into a browser.
 *
 * In the browser this is just where the page is served from. In a desktop
 * build the page origin is tauri://localhost, which Stripe rejects and nobody
 * can open - so the desktop build is given the real web origin explicitly.
 */
export const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_PUBLIC_ORIGIN ?? "";

/** Identifies which build this is, for support and bug reports. */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
export const BUILT_AT = process.env.NEXT_PUBLIC_BUILT_AT ?? "";
