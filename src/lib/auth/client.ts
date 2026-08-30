"use client";

import { useSyncExternalStore } from "react";
import {
  DUMMY_ACCOUNT,
  SESSION_COOKIE_NAME,
  isDummyCredential,
} from "./session";
import type { AuthPayload } from "@/lib/validation/auth";

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

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_COOKIE_NAME);
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
  return session === "demo-admin" ? DUMMY_ACCOUNT.displayName : "New Member";
}

// Replaces POST /api/auth/login and /api/auth/signup. The credential check is
// the same one the route handlers ran; it stays local until the Django API
// exposes real auth endpoints, at which point only this function changes.
export async function authenticate(payload: AuthPayload): Promise<AuthResult> {
  if (payload.mode === "login" && !isDummyCredential(payload)) {
    return {
      ok: false,
      message:
        "Invalid credentials. Use the MVP demo account shown on the page.",
    };
  }

  const value = isDummyCredential(payload) ? "demo-admin" : "new-member";
  setSession(value);

  return { ok: true, displayName: displayNameForSession(value) };
}
