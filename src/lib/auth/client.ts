"use client";

import { useSyncExternalStore } from "react";
import {
  ACCESS_TOKEN_KEY,
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
    return window.localStorage.getItem(SESSION_COOKIE_NAME);
  } catch {
    return null;
  }
}

function notify(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function setSession(value: string): void {
  try {
    window.localStorage.setItem(SESSION_COOKIE_NAME, value);
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
    window.localStorage.removeItem(SESSION_COOKIE_NAME);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(PHONE_VERIFIED_KEY);
    notify();
  } catch {
    // ignore
  }
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

// POST /api/v1/users/register/ on the Django API. Registering issues no
// tokens, so a successful signup immediately logs in with the same credentials.
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

    const result = await authenticate({
      username: payload.username,
      password: payload.password,
    });

    if (result.ok) {
      setPendingPhone(payload.phoneNumber);
    }

    return result;
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

    if (!response.ok) return;

    const envelope = (await response.json().catch(() => null)) as {
      data?: {
        phone_no_verified?: boolean;
        profile?: { phone_no_verified?: boolean };
      };
    } | null;

    const verified =
      envelope?.data?.phone_no_verified ??
      envelope?.data?.profile?.phone_no_verified ??
      false;

    setPhoneVerified(verified);
  } catch {
    // Keep the cached value; this is a best-effort refresh.
  }
}
