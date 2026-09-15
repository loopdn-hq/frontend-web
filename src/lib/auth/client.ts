"use client";

import { useSyncExternalStore } from "react";
import { googleLogout } from "@react-oauth/google";
import {
  ACCESS_TOKEN_KEY,
  EMAIL_VERIFIED_KEY,
  PENDING_EMAIL_KEY,
  PENDING_LOGIN_KEY,
  PENDING_PHONE_KEY,
  PHONE_VERIFIED_KEY,
  REFRESH_TOKEN_KEY,
  SESSION_COOKIE_NAME,
} from "./session";
import type { LoginPayload, SignupPayload } from "@/lib/validation/auth";
import { normalizePhone } from "@/lib/validation/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Client-side session, so every route can be prerendered to static HTML and
// served from S3. The previous server-side flow (cookies() in a page, POST
// handlers under /api/auth) needs a Node server at request time, which a
// static export has no way to provide.
//
// Note this is readable by JavaScript, unlike the httpOnly cookie it replaces.
// That is inherent to the static model, and is the same exposure the app takes
// on once auth moves to the Django API on another origin.

const SESSION_EVENT = "loopdn:session";

export type AuthResult =
  | { ok: true; displayName: string; isNewAccount?: boolean }
  | { ok: false; message: string; emailNotVerified?: boolean };

export function getSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(SESSION_COOKIE_NAME);
    return val && val.trim().length > 0 ? val : null;
  } catch {
    return null;
  }
}

function notify(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function setSession(value: string): void {
  try {
    if (!value || value.trim().length === 0) {
      window.localStorage.removeItem(SESSION_COOKIE_NAME);
    } else {
      window.localStorage.setItem(SESSION_COOKIE_NAME, value);
    }
    notify();
  } catch {
    // Private browsing or storage disabled. The route guards then treat the
    // user as signed out rather than the page breaking.
  }
}

export function setTokens(access: string, refresh: string): void {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    // Anything holding the old token has to hear about this. The websocket
    // in particular puts the access token in its URL, so without a nudge it
    // keeps reconnecting with the expired one until it gives up.
    notify();
  } catch {
    // ignore
  }
}

// One refresh at a time, shared by every caller that wants one.
//
// This is not an optimisation. ROTATE_REFRESH_TOKENS and
// BLACKLIST_AFTER_ROTATION are both on, so the refresh token is spent the
// moment it is used - two requests refreshing in parallel means the second
// presents an already-blacklisted token, is refused, and logs the user out.
// A single in-flight promise is what makes a burst of expired requests safe.
let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/users/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) return false;

    const payload = (await response.json().catch(() => null)) as {
      data?: { tokens?: { access?: string; refresh?: string } };
    } | null;
    const tokens = payload?.data?.tokens;
    if (!tokens?.access || !tokens?.refresh) return false;

    // Both, always: rotation means the refresh token that came back is the
    // only one that will work next time.
    setTokens(tokens.access, tokens.refresh);
    return true;
  } catch {
    return false;
  }
}

/** Trade the refresh token for a new pair. Returns false if it could not. */
export function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPendingPhone(phoneNumber: string): void {
  try {
    window.localStorage.setItem(PENDING_PHONE_KEY, phoneNumber);
  } catch {
    // ignore
  }
}

export function getPendingPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_PHONE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPhone(): void {
  try {
    window.localStorage.removeItem(PENDING_PHONE_KEY);
  } catch {
    // ignore
  }
}

export function setPendingEmail(email: string): void {
  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // ignore
  }
}

export function getPendingEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function clearPendingEmail(): void {
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export function setEmailVerified(verified: boolean): void {
  try {
    window.localStorage.setItem(EMAIL_VERIFIED_KEY, verified ? "1" : "0");
    notify();
  } catch {
    // ignore
  }
}

export function isEmailVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EMAIL_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

// Reactive read of the cached email_verified flag.
export function useEmailVerified(): boolean {
  return useSyncExternalStore(subscribe, isEmailVerified, () => false);
}

// sessionStorage (tab-scoped, cleared on read) so a freshly registered
// account (or one caught mid-login by "verify your email") can log in
// automatically once /verify-email confirms the code, without persisting the
// password anywhere longer-lived than that.
export function stashPendingCredentials(
  username: string,
  password: string,
): void {
  try {
    window.sessionStorage.setItem(
      PENDING_LOGIN_KEY,
      JSON.stringify({ username, password }),
    );
  } catch {
    // ignore
  }
}

function consumePendingCredentials(): LoginPayload | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_LOGIN_KEY);
    window.sessionStorage.removeItem(PENDING_LOGIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LoginPayload;
  } catch {
    return null;
  }
}

export function setPhoneVerified(verified: boolean): void {
  try {
    window.localStorage.setItem(PHONE_VERIFIED_KEY, verified ? "1" : "0");
    notify();
  } catch {
    // ignore
  }
}

export function isPhoneVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PHONE_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

// Reactive read of the cached phone_no_verified flag, kept in sync by
// setPhoneVerified() (verify-phone page, fetchCurrentUser()).
export function usePhoneVerified(): boolean {
  return useSyncExternalStore(subscribe, isPhoneVerified, () => false);
}

export function clearSession(): void {
  try {
    googleLogout();
  } catch {
    // ignore if GIS not loaded
  }

  try {
    window.localStorage.removeItem(SESSION_COOKIE_NAME);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(PHONE_VERIFIED_KEY);
    window.localStorage.removeItem(PENDING_PHONE_KEY);
    window.localStorage.removeItem(EMAIL_VERIFIED_KEY);
    notify();
  } catch {
    // ignore
  }
}

// Signs out the user: notifies the backend to blacklist the refresh token,
// invokes googleLogout() to revoke Google session tokens in GIS, and clears
// local storage.
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (accessToken && refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/users/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch {
      // Best-effort network logout; proceed to clear local state regardless
    }
  }

  clearSession();
}

let unauthorizedLogout: Promise<void> | null = null;

export async function handleUnauthorizedResponse(
  response: Response,
  { alreadyRetried = false }: { alreadyRetried?: boolean } = {},
): Promise<void> {
  if (response.status !== 401) return;

  // A 401 usually means the access token aged out, not that the session
  // ended - it lasts thirty minutes against a refresh token good for thirty
  // days. Spend the refresh token before concluding anything.
  //
  // `alreadyRetried` is how a caller that CAN retry says it already did: a
  // second 401 after a successful refresh is a real authorisation failure,
  // and refreshing again would keep the user signed in forever on a session
  // the server is refusing.
  if (!alreadyRetried && (await refreshTokens())) return;

  unauthorizedLogout ??= logout().finally(() => {
    unauthorizedLogout = null;
  });
  return unauthorizedLogout;
}

/**
 * The access token, as something React can re-render on.
 *
 * The websocket builds its URL from this, and a refresh has to move it - a
 * socket holding an expired token is closed by the server and reconnects with
 * the same dead token until it runs out of attempts.
 */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribe, getAccessToken, () => null);
}

// "storage" only fires in *other* tabs, so setSession/clearSession dispatch
// SESSION_EVENT for this one.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SESSION_EVENT, onChange);
  };
}

// Reads the session during render instead of assigning it from an effect,
// which is what keeps the route guards free of set-state-in-effect. The server
// snapshot is null, so the prerendered HTML is always the signed-out view.
export function useSession(): string | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}

const emptySubscribe = () => () => {};

// Client-safe auth hook that indicates whether hydration/localStorage has loaded.
// Guards should never redirect until isLoaded is true.
export function useAuth(): { session: string | null; isLoaded: boolean } {
  const isLoaded = useSyncExternalStore(
    emptySubscribe,
    () => typeof window !== "undefined",
    () => false,
  );
  const session = useSyncExternalStore(subscribe, getSession, () => null);

  return { session: isLoaded ? session : null, isLoaded };
}

export function displayNameForSession(session: string | null): string {
  return session ?? "New Member";
}

type Envelope = { code?: number; message?: string; data?: unknown };

// Every endpoint answers { code, message, data }; on failure `data` holds
// per-field errors (DRF style) and `message` holds a generic fallback.
function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const envelope = payload as Envelope;
  const fieldErrors = envelope.data;

  if (
    fieldErrors &&
    typeof fieldErrors === "object" &&
    !Array.isArray(fieldErrors)
  ) {
    for (const value of Object.values(fieldErrors as Record<string, unknown>)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return typeof envelope.message === "string" ? envelope.message : null;
}

// POST /api/v1/users/login/ — username accepts a username or an email.
export async function authenticate(payload: LoginPayload): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
      }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        extractErrorMessage(data) ?? "Incorrect username or password.";

      return {
        ok: false,
        message,
        emailNotVerified: message.toLowerCase().includes("verify your email"),
      };
    }

    const envelope = data as {
      data?: {
        user?: { username?: string; display_name?: string };
        tokens?: { access?: string; refresh?: string };
      };
    };
    const tokens = envelope.data?.tokens;

    if (tokens?.access && tokens?.refresh) {
      setTokens(tokens.access, tokens.refresh);
    }

    const username = envelope.data?.user?.username ?? payload.username;
    setSession(username);

    return {
      ok: true,
      displayName: envelope.data?.user?.display_name || username,
    };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/google/ — exchanges a Google Identity Services ID token
// for a session. 201 means a new account was created, 200 an existing one
// signed in; both come back with the same user/tokens shape as /users/login/.
export async function authenticateWithGoogle(
  credential: string,
): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/google/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to continue with Google. Please try again.",
      };
    }

    const envelope = data as {
      data?: {
        user?: { username?: string; display_name?: string };
        tokens?: { access?: string; refresh?: string };
      };
    };
    const tokens = envelope.data?.tokens;

    if (tokens?.access && tokens?.refresh) {
      setTokens(tokens.access, tokens.refresh);
    }

    const username = envelope.data?.user?.username ?? "";
    setSession(username);

    return {
      ok: true,
      displayName: envelope.data?.user?.display_name || username,
      isNewAccount: response.status === 201,
    };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/register/ on the Django API. Registration issues no
// tokens and sends the first email verification code itself. Login is
// deferred until the email is confirmed (see verifyEmailCode()), so the
// credentials are stashed in sessionStorage just long enough for that.
export async function registerAccount(
  payload: SignupPayload,
): Promise<AuthResult> {
  const normalizedPhone = normalizePhone(payload.phoneNumber);

  try {
    const response = await fetch(`${API_BASE_URL}/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: payload.username,
        email: payload.email,
        password: payload.password,
        confirm_password: payload.confirmPassword,
        first_name: payload.firstName,
        last_name: payload.lastName,
        display_name: payload.displayName?.trim() || payload.firstName,
        phone_number: normalizedPhone,
      }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to create your account. Please try again.",
      };
    }

    setPendingPhone(normalizedPhone);
    setPendingEmail(payload.email);
    stashPendingCredentials(payload.username, payload.password);

    return { ok: true, displayName: payload.displayName || payload.username };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/resend-code/ — re-sends the email verification code.
export async function resendEmailVerificationCode(
  email: string,
): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/resend-code/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to send a verification code. Please try again.",
      };
    }

    return { ok: true, displayName: email };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/verify-email/ — confirms the code sent at registration
// (or by resendEmailVerificationCode()). On success, logs in in the
// background with the credentials stashed by registerAccount() so the caller
// lands with an established session, then clears the pending state.
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "That code didn't work. Please try again.",
      };
    }

    setEmailVerified(true);
    clearPendingEmail();

    const credentials = consumePendingCredentials();
    if (!credentials) {
      return {
        ok: false,
        message: "Email verified. Please log in to continue.",
      };
    }

    return authenticate(credentials);
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// PATCH /api/v1/users/me/profile/ — sets phone_number for accounts (e.g. from
// Google sign-in) that didn't collect one at registration. Requires the
// access token set by authenticate()/authenticateWithGoogle().
export async function updatePhoneNumber(
  phoneNumber: string,
): Promise<AuthResult> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to add a phone number.",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/profile/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ phone_number: normalizedPhone }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to save that phone number. Please try again.",
      };
    }

    setPendingPhone(normalizedPhone);

    return { ok: true, displayName: normalizedPhone };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export type ProfileResult =
  | {
      ok: true;
      displayName?: string;
      username?: string;
      email?: string;
      phone?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
      // The account-wide switch for group email (MessagingSettings.email_enabled, carried on this endpoint). Per-group
      // opt-outs live on each conversation's delivery settings, not here.
      emailEnabled?: boolean;
      bio?: string;
      avatarUrl?: string;
    }
  | { ok: false; message: string };

// The profile fields as the API spells them, shared by the GET (nested under
// /users/me/) and the PATCH response (/users/me/profile/) so the two cannot
// read the same field two different ways.
type ApiProfile = {
  display_name?: string;
  email_verified?: boolean;
  phone_no_verified?: boolean;
  phone_number?: string;
  email_enabled?: boolean;
  bio?: string;
  avatar_url?: string;
};

// GET /api/v1/users/me/profile/ — the messaging profile (display name,
// phone, bio, avatar), separate from the base account. Requires the access
// token set by authenticate()/authenticateWithGoogle().
export async function fetchUserProfile(): Promise<ProfileResult> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to load your profile.",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message: extractErrorMessage(data) ?? "Unable to load your profile.",
      };
    }

    const envelope = data as {
      data?: {
        username?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        phone_number?: string;
        profile: ApiProfile;
      };
    };

    return {
      ok: true,
      displayName:
        envelope.data?.profile?.display_name ??
        envelope.data?.first_name + " " + envelope.data?.last_name,
      // Read-only: the API refuses username changes, because it is how every
      // message this account has already sent is attributed.
      username: envelope.data?.username,
      email: envelope.data?.email,
      phone: envelope.data?.profile?.phone_number,
      emailVerified: envelope.data?.profile?.email_verified,
      phoneVerified: envelope.data?.profile?.phone_no_verified,
      emailEnabled: envelope.data?.profile?.email_enabled,
      bio: envelope.data?.profile?.bio,
      avatarUrl: envelope.data?.profile?.avatar_url,
    };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// PATCH /api/v1/users/me/profile/. Only the fields given are sent, so a caller
// flipping one switch changes nothing else.
//
// Two encodings, chosen by whether there is a file. JSON for everything else,
// because it is the shape the rest of this module speaks; multipart when an
// avatar is being uploaded, because a file cannot travel in JSON. The endpoint
// declares MultiPartParser, FormParser and JSONParser, so it accepts either.
export async function updateUserProfile(profile: {
  displayName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  emailEnabled?: boolean;
  username?: string;
  /** A newly chosen image. Absent leaves the stored avatar untouched. */
  avatarFile?: File | null;
}): Promise<ProfileResult> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to update your profile.",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/profile/`, {
      method: "PATCH",
      // No Content-Type for multipart: the browser has to set it itself so it
      // can append the boundary, and naming it here produces a body the server
      // cannot split back apart.
      headers: profile.avatarFile
        ? { Authorization: `Bearer ${accessToken}` }
        : {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
      body: profile.avatarFile
        ? multipartProfile(profile)
        : JSON.stringify({
            display_name: profile.displayName,
            bio: profile.bio,
            email_enabled: profile.emailEnabled,
          }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message: extractErrorMessage(data) ?? "Unable to update your profile.",
      };
    }

    // What the server now holds, falling back to what was sent for the fields
    // the profile response does not carry (the account email).
    const saved = (data as { data?: ApiProfile } | null)?.data ?? {};

    return {
      ok: true,
      displayName: saved.display_name ?? profile.displayName,
      email: profile.email,
      phone: saved.phone_number ?? profile.phone,
      bio: saved.bio ?? profile.bio,
      // The freshly stored URL, so a new avatar appears without a reload.
      avatarUrl: saved.avatar_url ?? profile.avatarUrl,
      emailVerified: saved.email_verified ?? profile.emailVerified,
      phoneVerified: saved.phone_no_verified ?? profile.phoneVerified,
      emailEnabled: saved.email_enabled ?? profile.emailEnabled,
      // Echoed back untouched; it is not part of the PATCH body.
      username: profile.username,
    };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

/**
 * The same fields as the JSON body, plus the file.
 *
 * Undefined is skipped rather than sent: FormData has no undefined, so
 * appending one would post the string "undefined" and blank the field. JSON
 * drops those keys for free, which is why only this half needs the guard.
 */
function multipartProfile(profile: {
  displayName?: string;
  bio?: string;
  emailEnabled?: boolean;
  avatarFile?: File | null;
}): FormData {
  const form = new FormData();
  if (profile.displayName !== undefined) {
    form.append("display_name", profile.displayName);
  }
  if (profile.bio !== undefined) form.append("bio", profile.bio);
  if (profile.emailEnabled !== undefined) {
    form.append("email_enabled", String(profile.emailEnabled));
  }
  if (profile.avatarFile) form.append("avatar", profile.avatarFile);
  return form;
}

// POST /api/v1/users/me/phone/request-code/ — sends a verification SMS to the
// signed-in user's phone. Requires the access token set by authenticate().
export async function requestPhoneVerificationCode(
  phoneNumber: string,
): Promise<AuthResult> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to verify a phone number.",
    };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/users/me/phone/request-code/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ phone_number: normalizedPhone }),
      },
    );

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to send a verification code. Please try again.",
      };
    }

    return { ok: true, displayName: normalizedPhone };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/me/phone/verify/ — confirms the code sent by
// requestPhoneVerificationCode(). Requires the access token set by authenticate().
export async function verifyPhoneCode(code: string): Promise<AuthResult> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to verify a phone number.",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/phone/verify/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "That code didn't work. Please try again.",
      };
    }

    setPhoneVerified(true);
    clearPendingPhone();

    return { ok: true, displayName: "" };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export type FieldErrors = Record<string, string[]>;

// Every field in `data` on a DRF-style error response is a string or an
// array of strings; normalized here to string[] so callers can render every
// message for a field, not just the first one.
function extractFieldErrors(payload: unknown): FieldErrors {
  if (!payload || typeof payload !== "object") return {};

  const data = (payload as Envelope).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[key] = [value];
    } else if (Array.isArray(value)) {
      const messages = value.filter((v): v is string => typeof v === "string");
      if (messages.length > 0) result[key] = messages;
    }
  }
  return result;
}

export type ForgotPasswordResult = { ok: true } | { ok: false };

// POST /api/v1/users/forgot-password/ — anti-enumeration: whether the email
// matched an account is never revealed, so any response the backend actually
// sent (found, not found, rate-limited, ...) resolves the same way and the
// caller shows one generic message regardless. Only a genuine request
// failure (offline, timeout, CORS, 5xx) resolves differently, so the caller
// can tell the user something actually went wrong instead of lying to them.
export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/forgot-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    return { ok: response.status < 500 };
  } catch {
    return { ok: false };
  }
}

export type ResetPasswordResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors: FieldErrors;
      invalidOrExpired: boolean;
    };

// POST /api/v1/users/reset-password/ — confirms the uid/token from the email
// link and sets the new password.
export async function resetPassword(payload: {
  uid: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ResetPasswordResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/reset-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: payload.uid,
        token: payload.token,
        new_password: payload.newPassword,
        confirm_password: payload.confirmPassword,
      }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const fieldErrors = extractFieldErrors(data);
      const message =
        extractErrorMessage(data) ??
        "Unable to reset your password. Please try again.";

      // A bad/tampered uid or an invalid-or-expired token always comes back
      // as data.uid / data.token (confirmed against the backend), so this
      // checks those keys directly rather than guessing from message text.
      const invalidOrExpired = Boolean(fieldErrors.uid || fieldErrors.token);

      return { ok: false, message, fieldErrors, invalidOrExpired };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Network error. Please try again.",
      fieldErrors: {},
      invalidOrExpired: false,
    };
  }
}

export type ChangePasswordResult =
  { ok: true } | { ok: false; message: string; fieldErrors: FieldErrors };

// POST /api/v1/users/change-password/ — requires the signed-in user's access
// token; the backend re-checks old_password itself.
export async function changePassword(payload: {
  oldPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      message: "You must be signed in to change your password.",
      fieldErrors: {},
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/change-password/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        old_password: payload.oldPassword,
        new_password: payload.newPassword,
      }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return {
        ok: false,
        message:
          extractErrorMessage(data) ??
          "Unable to change your password. Please try again.",
        fieldErrors: extractFieldErrors(data),
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Network error. Please try again.",
      fieldErrors: {},
    };
  }
}

// GET /api/v1/users/me/ — refreshes the cached phone_no_verified flag, so
// gated actions reflect the backend's truth rather than only the local cache.
export async function fetchCurrentUser(): Promise<void> {
  const accessToken = getAccessToken();

  if (!accessToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      await handleUnauthorizedResponse(response);
      return;
    }

    const envelope = (await response.json().catch(() => null)) as {
      data?: {
        phone_no_verified?: boolean;
        email_verified?: boolean;
        profile?: { phone_no_verified?: boolean; email_verified?: boolean };
      };
    } | null;

    const verified =
      envelope?.data?.phone_no_verified ??
      envelope?.data?.profile?.phone_no_verified ??
      false;

    setPhoneVerified(verified);

    const emailVerified =
      envelope?.data?.email_verified ??
      envelope?.data?.profile?.email_verified ??
      false;

    setEmailVerified(emailVerified);
  } catch {
    // Keep the cached value; this is a best-effort refresh.
  }
}
