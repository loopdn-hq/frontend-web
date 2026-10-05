import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  disablePush,
  enablePush,
  permissionState,
  pushSupport,
  readPushState,
  syncPush,
  unsubscribeOnLogout,
} from "@/lib/app/push";
import { authorizedRequest } from "@/lib/chat/conversations";
import { brokenResponse, jsonResponse, stubMatchMedia } from "@/test/helpers";

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1";

type Subscription = {
  endpoint: string;
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
};

function makeSubscription(endpoint = "https://push.example/abc"): Subscription {
  return {
    endpoint,
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
  };
}

/**
 * A browser, as far as push is concerned. Everything defaults to a desktop
 * that supports push, has not been asked, and has nothing registered.
 */
function browser({
  userAgent = DESKTOP_UA,
  touchPoints = 0,
  apis = true,
  installed = false,
  standalone = false,
  permission = "default" as NotificationPermission,
  prompt = "granted" as NotificationPermission | Error,
  registered = true,
  subscription = null as Subscription | null,
} = {}) {
  const pushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => makeSubscription("https://push.example/new")),
  };
  const registration = { pushManager };
  const serviceWorker = {
    getRegistration: vi.fn(async () => (registered ? registration : undefined)),
    register: vi.fn(async () => registration),
  };

  const fakeNavigator: Record<string, unknown> = {
    userAgent,
    maxTouchPoints: touchPoints,
    standalone,
  };
  if (apis) fakeNavigator.serviceWorker = serviceWorker;
  vi.stubGlobal("navigator", fakeNavigator);
  if (apis) vi.stubGlobal("PushManager", class {});

  const requestPermission = vi.fn(async () => {
    if (prompt instanceof Error) throw prompt;
    return prompt;
  });
  vi.stubGlobal("Notification", { permission, requestPermission });
  stubMatchMedia(installed);

  return { pushManager, serviceWorker, requestPermission };
}

/** Answer each endpoint by path; anything unlisted succeeds with nothing. */
function server(routes: Record<string, Response | Error> = {}) {
  vi.mocked(authorizedRequest).mockImplementation(async (path) => {
    const answer = routes[path as string];
    if (answer instanceof Error) throw answer;
    return answer ?? jsonResponse(200, {});
  });
}

const KEY_ON = jsonResponse(200, {
  data: { enabled: true, public_key: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9" },
});

function requestsTo(path: string) {
  return vi
    .mocked(authorizedRequest)
    .mock.calls.filter((call) => call[0] === path)
    .map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

beforeEach(() => {
  vi.clearAllMocks();
  server({ "/push/key/": KEY_ON });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pushSupport", () => {
  it("is ready on a desktop browser with the APIs", () => {
    browser();
    expect(pushSupport()).toBe("ready");
  });

  it("is unsupported without a service worker or the Push API", () => {
    browser({ apis: false });
    expect(pushSupport()).toBe("unsupported");
  });

  it("asks an iPhone to be installed first, with or without the APIs", () => {
    browser({ userAgent: IPHONE_UA });
    expect(pushSupport()).toBe("needs-install");
    browser({ userAgent: IPHONE_UA, apis: false });
    expect(pushSupport()).toBe("needs-install");
  });

  it("is ready on an iPhone once it is on the Home Screen", () => {
    browser({ userAgent: IPHONE_UA, installed: true });
    expect(pushSupport()).toBe("ready");
    browser({ userAgent: IPHONE_UA, standalone: true });
    expect(pushSupport()).toBe("ready");
  });

  it("tells an iPad, which says it is a Mac, from a real Mac by touch", () => {
    browser({ userAgent: MAC_UA, touchPoints: 5 });
    expect(pushSupport()).toBe("needs-install");
    browser({ userAgent: MAC_UA, touchPoints: 0 });
    expect(pushSupport()).toBe("ready");
  });
});

describe("permissionState", () => {
  it("is the browser's own answer", () => {
    browser({ permission: "granted" });
    expect(permissionState()).toBe("granted");
  });

  it("is denied where notifications do not exist", () => {
    browser();
    // Not merely undefined: the check is whether the property is there at all.
    delete (globalThis as Record<string, unknown>).Notification;
    expect(permissionState()).toBe("denied");
  });
});

describe("readPushState", () => {
  it("reports a browser that cannot, without asking the server", async () => {
    browser({ apis: false });
    expect(await readPushState()).toEqual({
      support: "unsupported",
      permission: "default",
      subscribed: false,
      available: false,
    });
    expect(authorizedRequest).not.toHaveBeenCalled();
  });

  it("reports whether this browser is registered and the server can send", async () => {
    const mock = browser({
      permission: "granted",
      subscription: makeSubscription(),
    });
    expect(await readPushState()).toEqual({
      support: "ready",
      permission: "granted",
      subscribed: true,
      available: true,
    });
    expect(mock.requestPermission).not.toHaveBeenCalled();
  });

  it("is unavailable when the server has push switched off or cannot be reached", async () => {
    browser({ registered: false });
    server({
      "/push/key/": jsonResponse(200, { enabled: false, public_key: "x" }),
    });
    expect(await readPushState()).toMatchObject({
      subscribed: false,
      available: false,
    });

    server({ "/push/key/": jsonResponse(500, {}) });
    expect((await readPushState()).available).toBe(false);

    server({ "/push/key/": new Error("offline") });
    expect((await readPushState()).available).toBe(false);
  });

  it("reads a key that arrives without the envelope", async () => {
    browser();
    server({
      "/push/key/": jsonResponse(200, { enabled: true, public_key: "abc" }),
    });
    expect((await readPushState()).available).toBe(true);

    server({ "/push/key/": jsonResponse(200, { data: { enabled: true } }) });
    expect((await readPushState()).available).toBe(false);

    server({ "/push/key/": brokenResponse(200) });
    expect((await readPushState()).available).toBe(false);
  });
});

describe("enablePush", () => {
  it("asks, subscribes and registers this browser with the server", async () => {
    const mock = browser();
    expect(await enablePush()).toEqual({ ok: true });

    expect(mock.requestPermission).toHaveBeenCalledTimes(1);
    const [options] = mock.pushManager.subscribe.mock.calls[0] as unknown as [
      { userVisibleOnly: boolean; applicationServerKey: Uint8Array },
    ];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(options.applicationServerKey.length).toBeGreaterThan(0);

    expect(requestsTo("/push/subscriptions/")).toEqual([
      {
        endpoint: "https://push.example/new",
        keys: { p256dh: "p", auth: "a" },
        user_agent: DESKTOP_UA,
      },
    ]);
  });

  it("reuses a subscription the browser already has", async () => {
    const existing = makeSubscription("https://push.example/existing");
    const mock = browser({ subscription: existing });
    expect(await enablePush()).toEqual({ ok: true });
    expect(mock.pushManager.subscribe).not.toHaveBeenCalled();
    expect(requestsTo("/push/subscriptions/")[0].endpoint).toBe(
      "https://push.example/existing",
    );
  });

  it("registers the worker when there is not one yet", async () => {
    const mock = browser({ registered: false });
    expect(await enablePush()).toEqual({ ok: true });
    expect(mock.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("explains each reason it cannot, without prompting", async () => {
    let mock = browser({ userAgent: IPHONE_UA });
    expect(await enablePush()).toMatchObject({
      ok: false,
      message: expect.stringContaining("Home Screen"),
    });
    expect(mock.requestPermission).not.toHaveBeenCalled();

    mock = browser({ apis: false });
    expect(await enablePush()).toEqual({
      ok: false,
      message: "This browser cannot show notifications.",
    });

    mock = browser();
    server({ "/push/key/": jsonResponse(503, {}) });
    expect(await enablePush()).toEqual({
      ok: false,
      message: "Could not reach the notification service.",
    });

    server({ "/push/key/": jsonResponse(200, { data: { enabled: false } }) });
    expect(await enablePush()).toEqual({
      ok: false,
      message: "Notifications are not switched on for this server yet.",
    });
    expect(mock.requestPermission).not.toHaveBeenCalled();
  });

  it("says so when the prompt is denied, dismissed or throws", async () => {
    browser({ prompt: "denied" });
    expect(await enablePush()).toMatchObject({
      ok: false,
      message: expect.stringContaining("blocked for this site"),
    });

    browser({ prompt: new Error("no gesture") });
    expect(await enablePush()).toEqual({
      ok: false,
      message: "This browser refused the request.",
    });
    expect(requestsTo("/push/subscriptions/")).toEqual([]);
  });

  it("reports a browser that will not subscribe, and a server that will not register", async () => {
    const mock = browser();
    mock.pushManager.subscribe.mockRejectedValue(new Error("aborted"));
    expect(await enablePush()).toEqual({
      ok: false,
      message: "Could not turn notifications on for this browser.",
    });

    browser();
    server({
      "/push/key/": KEY_ON,
      "/push/subscriptions/": jsonResponse(400, {}),
    });
    expect(await enablePush()).toEqual({
      ok: false,
      message: "Could not register this browser.",
    });
  });
});

describe("disablePush", () => {
  it("turns the browser off first, then tells the server", async () => {
    const subscription = makeSubscription();
    browser({ subscription });
    const order: string[] = [];
    subscription.unsubscribe.mockImplementation(async () => {
      order.push("browser");
      return true;
    });
    vi.mocked(authorizedRequest).mockImplementation(async () => {
      order.push("server");
      return jsonResponse(200, {});
    });

    expect(await disablePush()).toEqual({ ok: true });
    expect(order).toEqual(["browser", "server"]);
    expect(requestsTo("/push/subscriptions/remove/")).toEqual([
      { endpoint: "https://push.example/abc" },
    ]);
  });

  it("has nothing to do when nothing is registered", async () => {
    browser({ registered: false });
    expect(await disablePush()).toEqual({ ok: true });
    browser({ apis: false });
    expect(await disablePush()).toEqual({ ok: true });
    expect(authorizedRequest).not.toHaveBeenCalled();
  });

  it("reports a failure rather than throwing", async () => {
    const subscription = makeSubscription();
    subscription.unsubscribe.mockRejectedValue(new Error("nope"));
    browser({ subscription });
    expect(await disablePush()).toEqual({
      ok: false,
      message: "Could not turn notifications off.",
    });
  });
});

describe("syncPush", () => {
  it("re-registers a browser that is already allowed", async () => {
    browser({ permission: "granted", subscription: makeSubscription() });
    await syncPush();
    expect(requestsTo("/push/subscriptions/")).toHaveLength(1);
  });

  it("does nothing without permission, without a subscription, or on failure", async () => {
    let mock = browser({
      permission: "default",
      subscription: makeSubscription(),
    });
    await syncPush();
    expect(mock.serviceWorker.getRegistration).not.toHaveBeenCalled();

    browser({ permission: "granted" });
    await syncPush();
    expect(authorizedRequest).not.toHaveBeenCalled();

    mock = browser({ permission: "granted" });
    mock.serviceWorker.getRegistration.mockRejectedValue(new Error("broken"));
    await expect(syncPush()).resolves.toBeUndefined();
  });
});

describe("unsubscribeOnLogout", () => {
  it("forgets this browser, here and on the server", async () => {
    const subscription = makeSubscription();
    browser({ subscription });
    await unsubscribeOnLogout();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(requestsTo("/push/subscriptions/remove/")).toHaveLength(1);
  });

  it("never lets a notification stop a sign-out", async () => {
    browser({ apis: false });
    await expect(unsubscribeOnLogout()).resolves.toBeUndefined();

    browser();
    await unsubscribeOnLogout();
    expect(authorizedRequest).not.toHaveBeenCalled();

    const subscription = makeSubscription();
    browser({ subscription });
    server({ "/push/subscriptions/remove/": new Error("dead token") });
    await expect(unsubscribeOnLogout()).resolves.toBeUndefined();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
