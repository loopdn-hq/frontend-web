export const SESSION_COOKIE_NAME = "loopdn_session";
export const ACCESS_TOKEN_KEY = "loopdn_access_token";
export const REFRESH_TOKEN_KEY = "loopdn_refresh_token";
// Phone number a just-registered account still needs to verify; read once by
// the /verify-phone page, then cleared.
export const PENDING_PHONE_KEY = "loopdn_pending_phone";
// Cached copy of the backend's phone_no_verified flag, so gated actions (like
// Create Loop) don't need a network round trip on every click.
export const PHONE_VERIFIED_KEY = "loopdn_phone_verified";
