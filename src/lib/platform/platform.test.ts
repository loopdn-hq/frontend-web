import { afterEach, describe, expect, it, vi } from "vitest";

import { stubLocation } from "@/test/helpers";
import { platform, setPlatform } from "@/lib/platform";
import { webPlatform } from "@/lib/platform/web";

afterEach(() => {
  vi.unstubAllGlobals();
  setPlatform(webPlatform);
});

describe("webPlatform", () => {
  it("opens an external URL by handing the tab over", async () => {
    const location = stubLocation("https://loopdn.com/settings/");
    await platform.openExternal("https://checkout.stripe.com/c/pay_1");
    expect(location.assign).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay_1",
    );
  });

  it("notifies only when permission was already granted, and never asks", async () => {
    const shown: unknown[][] = [];
    class FakeNotification {
      static permission = "granted";
      static requestPermission = vi.fn();
      constructor(...args: unknown[]) {
        shown.push(args);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);

    await platform.notify("Sam", "On my way");
    expect(shown).toEqual([["Sam", { body: "On my way" }]]);

    FakeNotification.permission = "default";
    await platform.notify("Sam", "Again");
    expect(shown).toHaveLength(1);
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("stays quiet where notifications do not exist", async () => {
    vi.stubGlobal("Notification", undefined);
    await expect(platform.notify("Sam", "Hi")).resolves.toBeUndefined();
  });

  it("has no badge to set on the web", async () => {
    await expect(platform.setBadge(3)).resolves.toBeUndefined();
  });
});

describe("setPlatform", () => {
  it("routes every capability to the replacement", async () => {
    const desktop = {
      openExternal: vi.fn(async () => {}),
      notify: vi.fn(async () => {}),
      setBadge: vi.fn(async () => {}),
    };
    setPlatform(desktop);

    await platform.openExternal("mailto:hi@loopdn.com");
    await platform.notify("Title", "Body");
    await platform.setBadge(2);

    expect(desktop.openExternal).toHaveBeenCalledWith("mailto:hi@loopdn.com");
    expect(desktop.notify).toHaveBeenCalledWith("Title", "Body");
    expect(desktop.setBadge).toHaveBeenCalledWith(2);
  });
});
