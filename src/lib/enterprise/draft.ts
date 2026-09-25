"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_CONFIGURATION, type EnterpriseConfiguration } from "./catalog";

// Local draft persistence for the Enterprise Plan Builder.
//
// The backend owns the authoritative draft (EnterprisePlanDraft - see PRD
// sections 11-13) once the user is signed in and submits; this is what lets
// the builder work before that - the draft lives in localStorage, survives a
// login/signup round trip on the same device, and carries the backend's own
// draft id (`remoteDraftId`) once one exists.

export type EnterpriseDraftStatus = "draft" | "submitted";

export type EnterpriseDraft = {
  /** Local-only bookkeeping id - never sent to the backend. */
  draftId: string;
  /**
   * The backend's own draft id, once one exists. `POST /enterprise/drafts/`
   * only accepts a `draft_id` in the body to UPDATE an existing draft - it
   * 404s if given an id it's never seen, so the very first submit must omit
   * `draft_id` entirely and let the backend generate one. This is that id,
   * null until the first successful submit.
   */
  remoteDraftId: string | null;
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

/**
 * Fills in feature keys a stored draft predates.
 *
 * This JSON was written by whichever build the person last used, and the draft
 * endpoint requires EVERY feature key on every save - so a draft saved before
 * calling was added would post without `calls`/`call_recording` and come back
 * 400, with nothing on screen to explain why. Missing keys default to off,
 * which is what they would have been.
 *
 * Only the keys are backfilled, never a saved choice: the parsed features
 * spread LAST so anything the person actually picked wins.
 */
function withEveryFeatureKey(
  configuration: EnterpriseConfiguration,
): EnterpriseConfiguration {
  return {
    ...configuration,
    features: {
      ...DEFAULT_CONFIGURATION.features,
      ...configuration.features,
    },
  };
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
        ? {
            ...parsed,
            configuration: withEveryFeatureKey(parsed.configuration),
          }
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
    remoteDraftId: existing?.remoteDraftId ?? null,
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

/**
 * Records the backend's draft id after a successful submit, so the next
 * submit updates that same draft instead of the backend 404ing on an id it's
 * never seen. No-ops (rather than throwing) if there's no local draft to
 * attach it to, which shouldn't happen in practice - this is only ever
 * called right after a submit that itself required a local draft to exist.
 */
export function setRemoteDraftId(remoteDraftId: string): void {
  const existing = loadEnterpriseDraft();
  if (!existing) return;

  const draft: EnterpriseDraft = {
    ...existing,
    remoteDraftId,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    notify();
  } catch {
    // ignore
  }
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
  return useSyncExternalStore(
    subscribe,
    loadEnterpriseDraft,
    getServerSnapshot,
  );
}
