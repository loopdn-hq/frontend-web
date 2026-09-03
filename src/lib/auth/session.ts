export const SESSION_COOKIE_NAME = "loopdn_session";
export const ACCESS_TOKEN_KEY = "loopdn_access_token";
export const REFRESH_TOKEN_KEY = "loopdn_refresh_token";
// Phone number a just-registered account still needs to verify; read once by
// the /verify-phone page, then cleared.
export const PENDING_PHONE_KEY = "loopdn_pending_phone";
// Cached copy of the backend's phone_no_verified flag, so gated actions (like
// Create Loop) don't need a network round trip on every click.
export const PHONE_VERIFIED_KEY = "loopdn_phone_verified";
// Email a just-registered account still needs to verify; read once by the
// /verify-email page, then cleared.
export const PENDING_EMAIL_KEY = "loopdn_pending_email";
// Cached copy of the backend's email_verified flag.
export const EMAIL_VERIFIED_KEY = "loopdn_email_verified";
// sessionStorage only (never localStorage): the just-registered credentials,
// held only long enough to log in once /verify-email confirms the code, then
// removed immediately. Registration itself issues no tokens.
export const PENDING_LOGIN_KEY = "loopdn_pending_login";
