import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  createConnection,
  detachGroupWhatsApp,
  disconnectConnection,
  fetchWhatsAppConfig,
  inviteByWhatsApp,
  refreshConnection,
  updateConnectionTemplates,
} from "@/lib/whatsapp/api";
import {
  loadFacebookSdk,
  resetFacebookSdkForTests,
  type FacebookSdk,
} from "@/lib/whatsapp/facebookSdk";
import {
  resetWhatsAppConfigForTests,
  useWhatsAppConfig,
} from "@/lib/whatsapp/useWhatsAppConfig";
import { deferred, jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  const request = (init ?? {}) as RequestInit;
  return {
    path: path as string,
    method: request.method,
    body: JSON.parse((request.body as string) ?? "null"),
  };
}

const CONNECTION = {
  id: 3,
  status: "odd",
  waba_id: "w1",
  phone_number_id: "p1",
  display_phone_number: "+1 555 000 1111",
  verified_name: "Acme",
  groups: [{ id: 9, name: "Team", keyword: "team" }, "junk"],
};

beforeEach(() => {
  vi.clearAllMocks();
  resetWhatsAppConfigForTests();
  resetFacebookSdkForTests();
});

afterEach(() => {
  delete window.FB;
  document.getElementById("facebook-jssdk")?.remove();
});

describe("WhatsApp connections", () => {
  it("reads the config that says whether the feature is on", async () => {
    respond(200, {
      data: { enabled: true, app_id: "app-1", config_id: "cfg-1", graph_version: "v21.0" },
    });
    expect(await fetchWhatsAppConfig()).toEqual({
      ok: true,
      data: { enabled: true, appId: "app-1", configId: "cfg-1", graphVersion: "v21.0" },
    });
    expect(lastRequest().path).toBe("/whatsapp/config/");

    respond(200, { data: null });
    expect((await fetchWhatsAppConfig()).ok).toBe(false);
  });

  it("creates a connection from what Embedded Signup returned", async () => {
    respond(201, { data: CONNECTION });
    const result = await createConnection({
      code: "c1",
      wabaId: "w1",
      phoneNumberId: "p1",
      businessId: "b1",
    });
    expect(lastRequest()).toEqual({
      path: "/whatsapp/connections/",
      method: "POST",
      body: { code: "c1", waba_id: "w1", phone_number_id: "p1", business_id: "b1" },
    });
    // A status it does not know is shown as needing attention, not as fine.
    expect(result.ok && result.data.status).toBe("error");
    expect(result.ok && result.data.groups).toEqual([
      { id: 9, name: "Team", keyword: "team" },
    ]);

    await createConnection({ code: "c1", wabaId: "w1", phoneNumberId: "p1" });
    expect(lastRequest().body).not.toHaveProperty("business_id");
  });

  it("patches only the template names it was given", async () => {
    respond(200, { data: CONNECTION });
    await updateConnectionTemplates(3, { invitationTemplateName: "invite_v2" });
    expect(lastRequest()).toEqual({
      path: "/whatsapp/connections/3/",
      method: "PATCH",
      body: { invitation_template_name: "invite_v2" },
    });

    await updateConnectionTemplates(3, {
      notificationTemplateName: "notify",
      notificationTemplateLanguage: "en_GB",
    });
    expect(lastRequest().body).toEqual({
      notification_template_name: "notify",
      notification_template_language: "en_GB",
    });
  });

  it("refreshes and disconnects a number, and takes a group off WhatsApp", async () => {
    respond(200, { data: CONNECTION });
    expect((await refreshConnection(3)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      path: "/whatsapp/connections/3/refresh/",
      method: "POST",
    });

    respond(200, { data: null });
    expect(await disconnectConnection(3)).toEqual({ ok: true, data: true });
    expect(lastRequest()).toMatchObject({
      path: "/whatsapp/connections/3/",
      method: "DELETE",
    });

    respond(200, { data: { connected: false, channel: { connection_status: "odd" } } });
    const detached = await detachGroupWhatsApp(9);
    expect(lastRequest()).toMatchObject({
      path: "/whatsapp/groups/9/",
      method: "DELETE",
    });
    expect(detached.ok && detached.data.channel).toMatchObject({
      connectionStatus: "error",
      deliveryEnabled: true,
      repliesEnabled: true,
    });
  });

  it("reads an invitation's outcome, treating an unknown one as not sent", async () => {
    respond(201, { data: { outcome: "teleported", participant: 5, channel: null } });
    const result = await inviteByWhatsApp(9, { participant: 5 });
    expect(result.ok && result.data).toEqual({
      outcome: "not_sent",
      participant: 5,
      channel: null,
      deliveryStatus: null,
      reason: "",
    });

    respond(201, { data: null });
    expect((await inviteByWhatsApp(9, { participant: 5 })).ok).toBe(false);
  });
});

describe("useWhatsAppConfig", () => {
  const CONFIG = {
    data: { enabled: true, app_id: "app-1", config_id: "cfg-1", graph_version: "v21.0" },
  };

  it("loads the config once and shares it between every screen that asks", async () => {
    respond(200, CONFIG);
    const first = renderHook(() => useWhatsAppConfig());
    const second = renderHook(() => useWhatsAppConfig());
    expect(first.result.current).toEqual({
      config: null,
      isLoading: true,
      isEnabled: false,
    });

    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    await waitFor(() => expect(second.result.current.isEnabled).toBe(true));
    expect(authorizedRequest).toHaveBeenCalledTimes(1);

    // Already cached: the next screen has it on its first render.
    const third = renderHook(() => useWhatsAppConfig());
    expect(third.result.current.isLoading).toBe(false);
    expect(third.result.current.config?.appId).toBe("app-1");
    expect(authorizedRequest).toHaveBeenCalledTimes(1);
  });

  it("is switched off when the config cannot be loaded, and asks again next time", async () => {
    respond(500, {});
    const first = renderHook(() => useWhatsAppConfig());
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current).toEqual({
      config: null,
      isLoading: false,
      isEnabled: false,
    });

    respond(200, CONFIG);
    const second = renderHook(() => useWhatsAppConfig());
    await waitFor(() => expect(second.result.current.isEnabled).toBe(true));
  });

  it("ignores a config that lands after unmount", async () => {
    const pending = deferred<Response>();
    vi.mocked(authorizedRequest).mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useWhatsAppConfig());
    unmount();
    pending.resolve(jsonResponse(200, CONFIG));
    await pending.promise;
    expect(result.current.isLoading).toBe(true);
  });
});

describe("loadFacebookSdk", () => {
  function fakeSdk(): FacebookSdk {
    return { init: vi.fn(), login: vi.fn() };
  }

  function sdkScript() {
    return document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
  }

  it("initialises an SDK that is already on the page without loading it again", async () => {
    const sdk = fakeSdk();
    window.FB = sdk;
    await expect(loadFacebookSdk("app-1", "v21.0")).resolves.toBe(sdk);
    expect(sdk.init).toHaveBeenCalledWith({
      appId: "app-1",
      version: "v21.0",
      xfbml: false,
    });
    expect(sdkScript()).toBeNull();
  });

  it("adds the script once, however many callers are waiting", async () => {
    const first = loadFacebookSdk("app-1", "v21.0");
    const second = loadFacebookSdk("app-1", "v21.0");
    expect(first).toBe(second);
    const script = sdkScript()!;
    expect(script.src).toBe("https://connect.facebook.net/en_US/sdk.js");
    expect(script.async).toBe(true);
    expect(document.querySelectorAll("#facebook-jssdk")).toHaveLength(1);

    const sdk = fakeSdk();
    window.FB = sdk;
    script.onload!(new Event("load"));
    await expect(first).resolves.toBe(sdk);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it("fails, and can be tried again, when the script loads but the SDK never appears", async () => {
    const attempt = loadFacebookSdk("app-1", "v21.0");
    sdkScript()!.onload!(new Event("load"));
    await expect(attempt).rejects.toThrow("The Facebook SDK could not start.");

    // The tag is still there, so the retry waits on it instead of adding another.
    const retry = loadFacebookSdk("app-1", "v21.0");
    expect(retry).not.toBe(attempt);
    expect(document.querySelectorAll("#facebook-jssdk")).toHaveLength(1);
    window.FB = fakeSdk();
    sdkScript()!.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBe(window.FB);
  });

  it("explains a blocked script, removes it, and can be tried again", async () => {
    const attempt = loadFacebookSdk("app-1", "v21.0");
    (sdkScript()!.onerror as () => void)();
    await expect(attempt).rejects.toThrow(/Couldn't load Facebook/);
    expect(sdkScript()).toBeNull();

    void loadFacebookSdk("app-1", "v21.0").catch(() => {});
    expect(sdkScript()).not.toBeNull();
  });
});
