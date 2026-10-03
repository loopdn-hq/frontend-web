import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFacebookOrigin,
  parseSignupMessage,
  useWhatsAppConnect,
} from "@/lib/whatsapp/useWhatsAppConnect";
import type { WhatsAppConfig, WhatsAppConnection } from "@/lib/whatsapp/types";

// Nothing in this file may reach Meta or the API.
vi.mock("@/lib/whatsapp/api", () => ({
  createConnection: vi.fn(),
}));
vi.mock("@/lib/whatsapp/facebookSdk", () => ({
  loadFacebookSdk: vi.fn(),
}));

import { createConnection } from "@/lib/whatsapp/api";
import { loadFacebookSdk } from "@/lib/whatsapp/facebookSdk";

const CONFIG: WhatsAppConfig = {
  enabled: true,
  appId: "app-1",
  configId: "config-1",
  graphVersion: "v21.0",
};

const CONNECTION = { id: 7, verifiedName: "Acme" } as WhatsAppConnection;

/** The FB.login callback the SDK would call, captured so a test can fire it. */
let loginCallback: ((response: unknown) => void) | null = null;

function mockSdk() {
  const login = vi.fn((callback: (response: unknown) => void) => {
    loginCallback = callback;
  });
  vi.mocked(loadFacebookSdk).mockResolvedValue({
    init: vi.fn(),
    login,
  } as never);
  return login;
}

/** A FINISH frame, as Meta posts it to the opener. */
function postFinish(origin = "https://www.facebook.com") {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      data: JSON.stringify({
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH",
        data: { waba_id: "waba-1", phone_number_id: "phone-1" },
      }),
    }),
  );
}

beforeEach(() => {
  loginCallback = null;
  vi.clearAllMocks();
  vi.mocked(createConnection).mockResolvedValue({
    ok: true,
    data: CONNECTION,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseSignupMessage", () => {
  it("reads a FINISH frame, as a string or an object", () => {
    const asObject = parseSignupMessage({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH",
      data: { waba_id: "w", phone_number_id: "p" },
    });
    expect(asObject).toEqual({
      kind: "finish",
      wabaId: "w",
      phoneNumberId: "p",
      businessId: undefined,
    });

    expect(
      parseSignupMessage(
        JSON.stringify({
          type: "WA_EMBEDDED_SIGNUP",
          event: "CANCEL",
          data: {},
        }),
      ),
    ).toEqual({ kind: "cancel" });
  });

  it("ignores anything that is not an Embedded Signup frame", () => {
    expect(parseSignupMessage("not json")).toBeNull();
    expect(parseSignupMessage({ type: "SOMETHING_ELSE" })).toBeNull();
    expect(parseSignupMessage(null)).toBeNull();
  });

  it("treats a FINISH with no number as an error, not a connection", () => {
    const parsed = parseSignupMessage({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH",
      data: { waba_id: "w" },
    });
    expect(parsed?.kind).toBe("error");
  });
});

describe("isFacebookOrigin", () => {
  it("accepts facebook.com over https and nothing else", () => {
    expect(isFacebookOrigin("https://www.facebook.com")).toBe(true);
    expect(isFacebookOrigin("https://facebook.com")).toBe(true);
    // The lookalike every origin check exists for.
    expect(isFacebookOrigin("https://facebook.com.evil.test")).toBe(false);
    expect(isFacebookOrigin("http://www.facebook.com")).toBe(false);
    expect(isFacebookOrigin("https://evil.test")).toBe(false);
  });
});

describe("useWhatsAppConnect", () => {
  it("connects when the code arrives before the session info", async () => {
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    let connected: WhatsAppConnection | null = null;
    await act(async () => {
      const promise = result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      loginCallback?.({ authResponse: { code: "code-1" } });
      postFinish();
      connected = await promise;
    });

    expect(connected).toEqual(CONNECTION);
    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(createConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "code-1",
        wabaId: "waba-1",
        phoneNumberId: "phone-1",
      }),
    );
  });

  it("connects when the session info arrives before the code", async () => {
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    let connected: WhatsAppConnection | null = null;
    await act(async () => {
      const promise = result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      postFinish();
      loginCallback?.({ authResponse: { code: "code-1" } });
      connected = await promise;
    });

    expect(connected).toEqual(CONNECTION);
    expect(createConnection).toHaveBeenCalledTimes(1);
  });

  it("posts the single-use code exactly once, even if both halves repeat", async () => {
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    await act(async () => {
      const promise = result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      loginCallback?.({ authResponse: { code: "code-1" } });
      postFinish();
      postFinish();
      loginCallback?.({ authResponse: { code: "code-1" } });
      await promise;
    });

    expect(createConnection).toHaveBeenCalledTimes(1);
  });

  it("closes quietly when the person cancels", async () => {
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    let connected: WhatsAppConnection | null = CONNECTION;
    await act(async () => {
      const promise = result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.facebook.com",
          data: JSON.stringify({
            type: "WA_EMBEDDED_SIGNUP",
            event: "CANCEL",
            data: {},
          }),
        }),
      );
      connected = await promise;
    });

    expect(connected).toBeNull();
    expect(createConnection).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("ignores a FINISH from any other origin", async () => {
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    await act(async () => {
      void result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      loginCallback?.({ authResponse: { code: "code-1" } });
      // A page pretending to be Meta must not be able to hand us a WABA.
      postFinish("https://facebook.com.evil.test");
    });

    expect(createConnection).not.toHaveBeenCalled();
  });

  it("gives up when only one half ever arrives", async () => {
    vi.useFakeTimers();
    mockSdk();
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    let connected: WhatsAppConnection | null = CONNECTION;
    let promise: Promise<void> | null = null;
    await act(async () => {
      promise = result.current.connect().then((value) => {
        connected = value;
      });
      await vi.advanceTimersByTimeAsync(0);
      loginCallback?.({ authResponse: { code: "code-1" } });
      // The session info never comes.
      await vi.advanceTimersByTimeAsync(61_000);
      await promise;
    });

    expect(connected).toBeNull();
    expect(createConnection).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/didn't finish|try again/i);
  });

  it("surfaces a refused exchange without retrying the code", async () => {
    mockSdk();
    vi.mocked(createConnection).mockResolvedValue({
      ok: false,
      message: "That number is already in use.",
      reason: "number_in_use",
      status: 400,
      retryable: false,
      rateLimited: false,
    });
    const { result } = renderHook(() => useWhatsAppConnect({ config: CONFIG }));

    let connected: WhatsAppConnection | null = CONNECTION;
    await act(async () => {
      const promise = result.current.connect();
      await waitFor(() => expect(loginCallback).not.toBeNull());
      loginCallback?.({ authResponse: { code: "code-1" } });
      postFinish();
      connected = await promise;
    });

    expect(connected).toBeNull();
    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("That number is already in use.");
  });

  it("refuses to start when the deployment has no WhatsApp", async () => {
    const login = mockSdk();
    const { result } = renderHook(() =>
      useWhatsAppConnect({ config: { ...CONFIG, enabled: false } }),
    );

    await act(async () => {
      expect(await result.current.connect()).toBeNull();
    });
    expect(login).not.toHaveBeenCalled();
    expect(loadFacebookSdk).not.toHaveBeenCalled();
  });
});
