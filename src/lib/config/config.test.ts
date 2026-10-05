import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubLocation } from "@/test/helpers";
import { DESKTOP_INSTALLERS, detectDesktopOs } from "@/lib/config/downloads";
import { http, setHttp } from "@/lib/config/http";
import { isDesktop, publicOrigin } from "@/lib/config/origin";
import {
  adminSiteUrl,
  belongsOnAdminSite,
  belongsOnCommercialSite,
  chatSiteUrl,
  commercialSiteUrl,
  homePath,
  isAdminPath,
  isAdminSite,
  isCommercialDashboardPath,
  isCommercialSite,
  useIsAdminSite,
  useIsCommercialSite,
} from "@/lib/config/site";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

function withUserAgent(userAgent: string) {
  vi.stubGlobal("navigator", { userAgent });
}

describe("detectDesktopOs", () => {
  it("offers the Mac installer on a Mac and the Windows one on Windows", () => {
    withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(detectDesktopOs()).toBe("mac");
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(detectDesktopOs()).toBe("windows");
  });

  it("never sells a phone or a tablet a desktop installer", () => {
    withUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(detectDesktopOs()).toBeNull();
    withUserAgent("Mozilla/5.0 (Linux; Android 14)");
    expect(detectDesktopOs()).toBeNull();
  });

  it("guesses nothing for Linux, or with no navigator at all", () => {
    withUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
    expect(detectDesktopOs()).toBeNull();
    vi.stubGlobal("navigator", undefined);
    expect(detectDesktopOs()).toBeNull();
  });

  it("points both installers at the stable channel", () => {
    expect(DESKTOP_INSTALLERS.mac.url).toBe(
      "https://downloads.loopdn.com/desktop/stable/Loopdn_universal.dmg",
    );
    expect(DESKTOP_INSTALLERS.windows.url).toMatch(/stable\/.*\.exe$/);
  });
});

describe("http", () => {
  it("is the global fetch until something replaces it", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await http("/ping", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/ping", { method: "POST" });

    const replacement = vi.fn(async () => new Response("native"));
    setHttp(replacement);
    await http("/pong");
    expect(replacement).toHaveBeenCalledWith("/pong");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setHttp((...args) => globalThis.fetch(...args));
  });
});

describe("origin", () => {
  it("knows the desktop shell by what Tauri injects", () => {
    expect(isDesktop()).toBe(false);
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(isDesktop()).toBe(true);
  });

  it("uses the page's own origin on the web", () => {
    stubLocation("https://loopdn.com/chats/");
    expect(publicOrigin()).toBe("https://loopdn.com");
  });

  it("prefers the build-time origin, which is what the desktop build has", async () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_ORIGIN", "https://app.loopdn.com");
    vi.resetModules();
    const fresh = await import("@/lib/config/origin");
    stubLocation("tauri://localhost/");
    expect(fresh.publicOrigin()).toBe("https://app.loopdn.com");
  });

  it("reads every build variable, defaulting each to empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.loopdn.com");
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "abc123");
    vi.resetModules();
    const env = await import("@/lib/config/env");
    expect(env.API_BASE_URL).toBe("https://api.loopdn.com");
    expect(env.BUILD_SHA).toBe("abc123");
    expect(env.BUILT_AT).toBe("");
  });
});

describe("site", () => {
  it("tells the three sites apart by hostname", () => {
    stubLocation("https://loopdn.com/");
    expect([isCommercialSite(), isAdminSite(), homePath()]).toEqual([
      false,
      false,
      "/chats/",
    ]);

    stubLocation("https://commercial.loopdn.com/");
    expect([isCommercialSite(), isAdminSite(), homePath()]).toEqual([
      true,
      false,
      "/",
    ]);

    stubLocation("https://admin.loopdn.com/");
    expect([isCommercialSite(), isAdminSite(), homePath()]).toEqual([
      false,
      true,
      "/admin/",
    ]);
  });

  it("gives rendering the same answer", () => {
    stubLocation("https://commercial.localhost:3002/");
    expect(renderHook(() => useIsCommercialSite()).result.current).toBe(true);
    expect(renderHook(() => useIsAdminSite()).result.current).toBe(false);

    stubLocation("https://admin.localhost:3002/");
    expect(renderHook(() => useIsAdminSite()).result.current).toBe(true);
  });

  it("builds each site's address from wherever the page is", () => {
    stubLocation("https://loopdn.com/chats/");
    expect(commercialSiteUrl()).toBe("https://commercial.loopdn.com/");
    expect(adminSiteUrl()).toBe("https://admin.loopdn.com/admin/");
    expect(chatSiteUrl("/login/")).toBe("https://loopdn.com/login/");

    stubLocation("http://admin.localhost:3002/admin/");
    expect(chatSiteUrl()).toBe("http://localhost:3002/");
    expect(commercialSiteUrl("/campaigns/")).toBe(
      "http://commercial.localhost:3002/campaigns/",
    );
    expect(adminSiteUrl("/admin/campaigns/")).toBe(
      "http://admin.localhost:3002/admin/campaigns/",
    );
  });

  it("knows which pages the commercial site may show", () => {
    expect(isCommercialDashboardPath("/campaigns")).toBe(true);
    expect(isCommercialDashboardPath("/campaigns/new/")).toBe(true);
    expect(isCommercialDashboardPath("/")).toBe(false);
    expect(belongsOnCommercialSite("/")).toBe(true);
    expect(belongsOnCommercialSite("/login")).toBe(true);
    expect(belongsOnCommercialSite("/balance/")).toBe(true);
    expect(belongsOnCommercialSite("/chats/")).toBe(false);
    expect(belongsOnCommercialSite("/admin/")).toBe(false);
  });

  it("knows which pages the admin site may show - and that signup is not one", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/permissions/")).toBe(true);
    expect(isAdminPath("/administrator-notes/")).toBe(false);
    expect(belongsOnAdminSite("/admin/campaigns/")).toBe(true);
    expect(belongsOnAdminSite("/login/")).toBe(true);
    expect(belongsOnAdminSite("/signup/")).toBe(false);
    expect(belongsOnAdminSite("/add-phone/")).toBe(false);
    expect(belongsOnAdminSite("/chats/")).toBe(false);
  });
});
