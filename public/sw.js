/**
 * The service worker: what runs when Loopd'n is not open.
 *
 * Two jobs, and deliberately nothing else. It does NOT cache the app or make
 * it work offline - a chat app showing yesterday's messages with no way to
 * send is worse than one that says it is offline - so there is no fetch
 * handler here at all.
 *
 *   push              show the notification the server sent
 *   notificationclick open the conversation it is about
 *
 * The payload shape is a contract with backend/push/payloads.py:
 *   {title, body, tag, silent, url, data: {conversation_id, message_id, kind}}
 *
 * This file is served from the site root so its scope is the whole app. It
 * cannot read localStorage, so it never sees an access token and never calls
 * the API: everything it needs is inside the encrypted payload.
 *
 * Plain JS, not TypeScript, and in public/ rather than src/: it is deployed as
 * a file at a fixed URL, not bundled. Keep it small and dependency-free.
 */

const FALLBACK = {
  title: "Loopd'n",
  body: "Something new is waiting for you.",
  url: "/chats/",
};

self.addEventListener("push", (event) => {
  // A push with no readable body still means something arrived. Showing the
  // fallback is required rather than merely polite: Chrome replaces a push
  // that displays nothing with its own "This site has been updated in the
  // background" notice, which is worse than anything we would have written.
  let payload = FALLBACK;
  if (event.data) {
    try {
      payload = { ...FALLBACK, ...event.data.json() };
    } catch {
      payload = { ...FALLBACK, body: event.data.text() || FALLBACK.body };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      // Monochrome, Android only, shown in the status bar.
      badge: "/icons/badge-72.png",
      // One live notification per conversation: without this, a busy Loop
      // stacks twenty alerts somebody has to dismiss one at a time.
      tag: payload.tag,
      // ...but each new message still buzzes, rather than silently replacing
      // the last one.
      renotify: Boolean(payload.tag),
      silent: Boolean(payload.silent),
      timestamp: Date.now(),
      data: { url: payload.url || FALLBACK.url, ...(payload.data || {}) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || FALLBACK.url;
  const conversationId = data.conversation_id ?? null;

  event.waitUntil(focusOrOpen(url, conversationId));
});

/**
 * Bring an existing Loopd'n tab forward rather than opening a second one.
 *
 * Somebody who already has the app open and clicks a notification expects to
 * land in that conversation in the tab they were using - not in a new tab with
 * a second websocket, a second unread count, and their half-typed reply left
 * behind in the first.
 *
 * The open tab is told through postMessage instead of by changing its URL:
 * which conversation is selected is client state in the app shell, and a hash
 * change alone would not move an app that is already running.
 */
async function focusOrOpen(url, conversationId) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windows) {
    if (new URL(client.url).origin !== self.location.origin) continue;

    if (conversationId !== null) {
      client.postMessage({
        type: "loopdn:open-conversation",
        conversationId,
      });
    }
    if ("focus" in client) return client.focus();
  }

  if (self.clients.openWindow) return self.clients.openWindow(url);
  return undefined;
}

/**
 * Take over as soon as a new version is deployed.
 *
 * Without these two, a replaced worker waits for every tab to close before it
 * starts - so a fix to a notification would reach somebody who keeps the app
 * open in a pinned tab weeks later, or never.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
