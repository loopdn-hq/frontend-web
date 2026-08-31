"use client";

import { useSyncExternalStore } from "react";
import {
  ACCESS_TOKEN_KEY,
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
  { ok: true; displayName: string } | { ok: false; message: string };

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

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_COOKIE_NAME);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
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
export async function authenticate(
  payload: LoginPayload,
): Promise<AuthResult> {
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
        message:
          extractErrorMessage(data) ?? "Incorrect username or password.",
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

    return authenticate({
      username: payload.username,
      password: payload.password,
    });
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}
