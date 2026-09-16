"use client";

import { useSyncExternalStore } from "react";
import type { EnterpriseConfiguration } from "./catalog";

// Anonymous-draft persistence for the Enterprise Plan Builder.
//
// The PRD calls for the backend to own drafts (EnterprisePlanDraft, attach on
// login, freeze into a contract, etc. - see PRD sections 11-13). None of that
// API exists yet, so this is a local stand-in: the draft lives in
// localStorage, survives a login/signup round trip on the same device, and
// can be swapped for real `POST/GET /enterprise/drafts/` calls later without
// changing the builder page's shape (draftId + configuration + status).

export type EnterpriseDraftStatus = "draft" | "submitted";

export type EnterpriseDraft = {
  draftId: string;
  configuration: EnterpriseConfiguration;
  status: EnterpriseDraftStatus;
  createdAt: string;
  updatedAt: string;
};

const DRAFT_STORAGE_KEY = "loopdn_enterprise_draft";
const DRAFT_EVENT = "loopdn:enterprise-draft";

function generateDraftId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `ent_draft_${random}`;
}

function notify(): void {
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

// useEnterpriseDraft() below calls this as a useSyncExternalStore snapshot,
// which requires a stable reference when nothing changed - JSON.parse-ing
// the same string on every call would return a new object each time and
// send React into an infinite re-render loop ("the result of getSnapshot
// should be cached"). Caching by the raw string is enough: it only changes
// when saveEnterpriseDraft()/clearEnterpriseDraft() actually write it.
let cachedRaw: string | null = null;
let cachedDraft: EnterpriseDraft | null = null;

export function loadEnterpriseDraft(): EnterpriseDraft | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === cachedRaw) return cachedDraft;
  cachedRaw = raw;

  if (!raw) {
    cachedDraft = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as EnterpriseDraft;
    cachedDraft =
      parsed && typeof parsed === "object" && parsed.configuration
        ? parsed
        : null;
  } catch {
    cachedDraft = null;
  }

  return cachedDraft;
}

export function saveEnterpriseDraft(
  configuration: EnterpriseConfiguration,
  status: EnterpriseDraftStatus = "draft",
): EnterpriseDraft {
  const existing = loadEnterpriseDraft();
  const now = new Date().toISOString();
  const draft: EnterpriseDraft = {
    draftId: existing?.draftId ?? generateDraftId(),
    configuration,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    notify();
  } catch {
    // Private browsing or storage disabled - the builder still works for the
    // current page view, it just won't survive a reload or login redirect.
  }

  return draft;
}

export function clearEnterpriseDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    notify();
  } catch {
    // ignore
  }
}

// "storage" only fires in *other* tabs, so save/clear above dispatch
// DRAFT_EVENT for this one - same trick as the auth module's session store.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}

const getServerSnapshot = () => null;

/**
 * Reads the draft during render rather than loading it in an effect.
 * useSyncExternalStore renders getServerSnapshot()'s value (null) through
 * hydration, then re-checks the real client store right after and applies
 * any difference as an ordinary update - so a saved draft still appears
 * immediately, but never as a hydration mismatch. Mirrors useSession() in
 * lib/auth/client.ts.
 */
export function useEnterpriseDraft(): EnterpriseDraft | null {
  return useSyncExternalStore(subscribe, loadEnterpriseDraft, getServerSnapshot);
}
