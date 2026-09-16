"use client";

/**
 * Turning browser notifications on and off, for THIS browser.
 *
 * Two different things are easy to confuse here, and keeping them apart is
 * most of what this file is for:
 *
 *   the switches   Settings -> Notifications, saved on the ACCOUNT (what you
 *                  are told about) - lib/user/notificationPreferences.ts
 *   the permission this browser agreeing to show anything at all, which lives
 *                  in the browser and cannot be saved anywhere else
 *
 * Somebody signed in on a laptop and a phone has to allow it twice, and
 * switching a row off on one of them silences both. The screen says so.
 *
 * The permission prompt may only be opened from a real click (browsers block
 * and penalise sites that ask on load), so `enablePush` is called from a
 * button and nothing here asks by itself.
 */

import { authorizedRequest } from "@/lib/chat/conversations";

/** Where the service worker lives. Root scope, so it covers every route. */
const WORKER_URL = "/sw.js";

export type PushSupport =
  /** No service worker or no Push API - an old browser, or a private window. */
  | "unsupported"
  /** iOS only shows notifications for a site added to the Home Screen. */
  | "needs-install"
  | "ready";

export type PushState = {
  support: PushSupport;
  /** The browser's own answer: "default" (never asked), "granted", "denied". */
  permission: NotificationPermission;
  /** Whether THIS browser is registered with the server right now. */
  subscribed: boolean;
  /** False when the server has no VAPID key configured, so nothing can send. */
  available: boolean;
};

type Result = { ok: true } | { ok: false; message: string };

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // iOS below 16.4, and any browser in a mode that strips these APIs.
    return isApple() && !isInstalled() ? "needs-install" : "unsupported";
  }
  // iOS 16.4+ has the APIs but refuses to subscribe until the site has been
  // added to the Home Screen, so saying "ready" here would produce a button
  // that always fails.
  if (isApple() && !isInstalled()) return "needs-install";
  return "ready";
}

export function permissionState(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * What the Settings screen should show, without changing anything.
 *
 * Never prompts. Reading the state has to be safe to do on render; asking for
 * permission has to be a deliberate click.
 */
export async function readPushState(): Promise<PushState> {
  const support = pushSupport();
  const permission = permissionState();

  if (support !== "ready") {
    return { support, permission, subscribed: false, available: false };
  }

  const key = await fetchServerKey();
  const subscription = await currentSubscription();

  return {
    support,
    permission,
    subscribed: subscription !== null,
    available: key.ok && Boolean(key.publicKey),
  };
}

/**
 * Ask this browser for permission, then register it with the server.
 *
 * Call from a click handler only. Returns a reason rather than throwing, in
 * the house style, because every failure here is something to show the person:
 * a denied prompt, a browser that cannot, or a server with push switched off.
 */
export async function enablePush(): Promise<Result> {
  const support = pushSupport();
  if (support === "needs-install") {
    return {
      ok: false,
      message:
        "On iPhone and iPad, add Loopd'n to your Home Screen first - then notifications can be turned on.",
    };
  }
  if (support === "unsupported") {
    return {
      ok: false,
      message: "This browser cannot show notifications.",
    };
  }

  const key = await fetchServerKey();
  if (!key.ok) return key;
  if (!key.publicKey) {
    return {
      ok: false,
      message: "Notifications are not switched on for this server yet.",
    };
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, message: "This browser refused the request." };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      message:
        "Notifications are blocked for this site. Allow them in your browser's settings for this page, then try again.",
    };
  }

  try {
    const registration = await registerWorker();
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must always show something. The
        // service worker honours it - see public/sw.js.
        userVisibleOnly: true,
        applicationServerKey: decodeKey(key.publicKey),
      }));

    return await sendSubscription(subscription);
  } catch {
    return {
      ok: false,
      message: "Could not turn notifications on for this browser.",
    };
  }
}

/** Stop this browser being notified, here and on the server. */
export async function disablePush(): Promise<Result> {
  try {
    const subscription = await currentSubscription();
    if (subscription === null) return { ok: true };

    const { endpoint } = subscription;
    // The browser first: if the server call fails, the browser is still off,
    // which is what was asked for. The other order can leave somebody
    // receiving notifications they have just switched off.
    await subscription.unsubscribe();
    await forgetSubscription(endpoint);
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not turn notifications off." };
  }
}

/**
 * Re-register a browser that is already allowed, on sign-in and on load.
 *
 * Cheap and silent - it never prompts. It exists for two cases that would
 * otherwise send someone's notifications to the wrong place: a shared computer
 * where somebody else signed in (the server moves the endpoint to whoever is
 * signed in now), and a subscription the browser quietly replaced.
 */
export async function syncPush(): Promise<void> {
  if (pushSupport() !== "ready" || permissionState() !== "granted") return;

  try {
    const registration = await registerWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription !== null) await sendSubscription(subscription);
  } catch {
    // Nothing to tell anybody: they asked for nothing, and notifications
    // carrying on as they were is the worst outcome.
  }
}

/**
 * Forget this browser on sign-out, without asking the server.
 *
 * Called from `logout()` while the token is still valid, so the server call
 * usually lands - but a forced sign-out (a dead token) reaches the browser
 * half regardless, which is the half that matters on a shared computer.
 */
export async function unsubscribeOnLogout(): Promise<void> {
  if (pushSupport() !== "ready") return;

  try {
    const subscription = await currentSubscription();
    if (subscription === null) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await forgetSubscription(endpoint);
  } catch {
    // Signing out must never fail because of a notification.
  }
}

// --- the server ------------------------------------------------------------

async function fetchServerKey(): Promise<
  { ok: true; publicKey: string } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest("/push/key/");
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: "Could not reach the notification service.",
      };
    }
    const data = body?.data ?? body;
    return {
      ok: true,
      publicKey: data?.enabled ? String(data?.public_key ?? "") : "",
    };
  } catch {
    return { ok: false, message: "Could not reach the notification service." };
  }
}

async function sendSubscription(
  subscription: PushSubscription,
): Promise<Result> {
  // toJSON() is exactly {endpoint, keys:{p256dh, auth}} - the shape the
  // backend serializer accepts, passed through rather than taken apart.
  const payload = subscription.toJSON();

  const response = await authorizedRequest("/push/subscriptions/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
      user_agent: navigator.userAgent.slice(0, 200),
    }),
  });

  if (!response.ok) {
    return { ok: false, message: "Could not register this browser." };
  }
  return { ok: true };
}

async function forgetSubscription(endpoint: string): Promise<void> {
  await authorizedRequest("/push/subscriptions/remove/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

// --- the browser -----------------------------------------------------------

async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(WORKER_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(WORKER_URL);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ready") return null;
  const registration =
    await navigator.serviceWorker.getRegistration(WORKER_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * The VAPID public key, base64url as the server prints it, as the bytes the
 * browser wants. There is no built-in for this - every web push client on the
 * internet carries the same nine lines.
 */
function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac, so the touch check is what separates a
  // tablet (which needs installing) from a desktop (which does not).
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's own, non-standard flag for a Home Screen app.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}
