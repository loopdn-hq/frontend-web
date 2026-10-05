import { afterEach, describe, expect, it, vi } from "vitest";

import { describeBrowser } from "@/lib/app/describeBrowser";
import { readNavCollapsed, writeNavCollapsed } from "@/lib/app/navCollapse";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("describeBrowser", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      "Chrome on macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 OPR/106.0",
      "Opera on Windows",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36",
      "Samsung Internet on Android",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Firefox on Linux",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1",
      "Chrome on iOS",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      "Safari on macOS",
    ],
  ])("%s", (userAgent, expected) => {
    expect(describeBrowser(userAgent)).toBe(expected);
  });

  it("says what it can when it only recognises half", () => {
    expect(describeBrowser("Something/1.0 (Windows NT 10.0)")).toBe(
      "A browser on Windows",
    );
    expect(describeBrowser("Firefox/121.0")).toBe("Firefox");
    expect(describeBrowser("")).toBe("This browser");
  });
});

describe("nav collapse", () => {
  it("remembers the rail's state across loads", () => {
    expect(readNavCollapsed()).toBe(false);
    writeNavCollapsed(true);
    expect(readNavCollapsed()).toBe(true);
    writeNavCollapsed(false);
    expect(readNavCollapsed()).toBe(false);
  });

  it("falls back to expanded when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readNavCollapsed()).toBe(false);
    expect(() => writeNavCollapsed(true)).not.toThrow();
  });
});
