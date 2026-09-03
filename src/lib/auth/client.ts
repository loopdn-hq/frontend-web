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
  | { ok: false; message: string };

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
  } catch {
    // ignore
  }
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
// account can log in automatically once /verify-email confirms the code,
// without persisting the password anywhere longer-lived than that.
function stashPendingCredentials(username: string, password: string): void {
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

export function handleUnauthorizedResponse(response: Response): Promise<void> {
  if (response.status !== 401) return Promise.resolve();

  unauthorizedLogout ??= logout().finally(() => {
    unauthorizedLogout = null;
  });
  return unauthorizedLogout;
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
      return {
        ok: false,
        message: extractErrorMessage(data) ?? "Incorrect username or password.",
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
        phone_number: payload.phoneNumber,
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

    setPendingPhone(payload.phoneNumber);
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
      body: JSON.stringify({ phone_number: phoneNumber }),
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

    setPendingPhone(phoneNumber);

    return { ok: true, displayName: phoneNumber };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export type ProfileResult =
  | { ok: true; displayName?: string; email?: string; phone?: string }
  | { ok: false; message: string };

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
    const response = await fetch(`${API_BASE_URL}/users/me/profile/`, {
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
        display_name?: string;
        email?: string;
        phone_number?: string;
      };
    };

    return {
      ok: true,
      displayName: envelope.data?.display_name,
      email: envelope.data?.email,
      phone: envelope.data?.phone_number,
    };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

// POST /api/v1/users/me/phone/request-code/ — sends a verification SMS to the
// signed-in user's phone. Requires the access token set by authenticate().
export async function requestPhoneVerificationCode(
  phoneNumber: string,
): Promise<AuthResult> {
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
        body: JSON.stringify({ phone_number: phoneNumber }),
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

    return { ok: true, displayName: phoneNumber };
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
