import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-oauth/google", () => ({ googleLogout: vi.fn() }));
vi.mock("@/lib/app/push", () => ({ unsubscribeOnLogout: vi.fn() }));

import { googleLogout } from "@react-oauth/google";

import { unsubscribeOnLogout } from "@/lib/app/push";
import {
  authenticate,
  authenticateWithGoogle,
  changePassword,
  clearPendingEmail,
  clearPendingPhone,
  clearSession,
  consumePostAuthRedirect,
  displayNameForSession,
  fetchCurrentUser,
  fetchUserProfile,
  getAccessToken,
  getPendingEmail,
  getPendingPhone,
  getRefreshToken,
  getSession,
  handleUnauthorizedResponse,
  isEmailVerified,
  isPhoneVerified,
  logout,
  refreshTokens,
  registerAccount,
  requestPasswordReset,
  requestPhoneVerificationCode,
  resendEmailVerificationCode,
  resetPassword,
  setEmailVerified,
  setPendingEmail,
  setPendingPhone,
  setPhoneVerified,
  setPostAuthRedirect,
  setSession,
  setTokens,
  stashPendingCredentials,
  updatePhoneNumber,
  updateUserProfile,
  useAccessToken,
  useAuth,
  useEmailVerified,
  usePhoneVerified,
  useSession,
  verifyEmailCode,
  verifyPhoneCode,
} from "@/lib/auth/client";
import {
  ACCESS_TOKEN_KEY,
  PENDING_LOGIN_KEY,
  REFRESH_TOKEN_KEY,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { setHttp } from "@/lib/config/http";
import {
  saveEnterpriseDraft,
  loadEnterpriseDraft,
} from "@/lib/enterprise/draft";
import { DEFAULT_CONFIGURATION } from "@/lib/enterprise/catalog";
import { brokenResponse, jsonResponse, stubLocation } from "@/test/helpers";

const http = vi.fn();

/** Answer by path; anything unlisted is a plain 200. */
function server(routes: Record<string, Response | Error | (() => Response)>) {
  http.mockImplementation(async (url: string) => {
    const answer = routes[url];
    if (answer instanceof Error) throw answer;
    if (typeof answer === "function") return answer();
    return answer ?? jsonResponse(200, {});
  });
}

function requestsTo(url: string) {
  return http.mock.calls
    .filter((call) => call[0] === url)
    .map((call) => {
      const init = (call[1] ?? {}) as RequestInit;
      return {
        method: init.method,
        headers: init.headers as Record<string, string> | undefined,
        raw: init.body,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      };
    });
}

function signIn(access = "access-1", refresh = "refresh-1") {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  localStorage.setItem(SESSION_COOKIE_NAME, "sam");
}

function blockStorage() {
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("blocked");
    });
  }
}

const NETWORK_ERROR = {
  ok: false,
  message: "Network error. Please try again.",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  http.mockReset();
  server({});
  setHttp(http as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setHttp((...args) => globalThis.fetch(...args));
});

describe("the session", () => {
  it("stores the signed-in username, and removes it for an empty one", () => {
    expect(getSession()).toBeNull();
    setSession("sam");
    expect(getSession()).toBe("sam");
    setSession("   ");
    expect(getSession()).toBeNull();

    localStorage.setItem(SESSION_COOKIE_NAME, "  ");
    expect(getSession()).toBeNull();
  });

  it("stores both tokens", () => {
    setTokens("a", "r");
    expect(getAccessToken()).toBe("a");
    expect(getRefreshToken()).toBe("r");
  });

  it("names the session, or a new member when there is none", () => {
    expect(displayNameForSession("sam")).toBe("sam");
    expect(displayNameForSession(null)).toBe("New Member");
  });

  it("keeps the pending phone and email until they are cleared", () => {
    setPendingPhone("+14155552671");
    setPendingEmail("sam@example.com");
    expect(getPendingPhone()).toBe("+14155552671");
    expect(getPendingEmail()).toBe("sam@example.com");
    clearPendingPhone();
    clearPendingEmail();
    expect(getPendingPhone()).toBeNull();
    expect(getPendingEmail()).toBeNull();
  });

  it("caches whether the email and phone are verified", () => {
    expect([isEmailVerified(), isPhoneVerified()]).toEqual([false, false]);
    setEmailVerified(true);
    setPhoneVerified(true);
    expect([isEmailVerified(), isPhoneVerified()]).toEqual([true, true]);
    setEmailVerified(false);
    setPhoneVerified(false);
    expect([isEmailVerified(), isPhoneVerified()]).toEqual([false, false]);
  });

  it("hands back a post-sign-in path once, and only a relative one", () => {
    setPostAuthRedirect("/enterprise/builder/");
    expect(consumePostAuthRedirect()).toBe("/enterprise/builder/");
    expect(consumePostAuthRedirect()).toBeNull();

    setPostAuthRedirect("https://evil.example/");
    expect(consumePostAuthRedirect()).toBeNull();
  });

  it("reads as signed out, and never throws, when storage is blocked", () => {
    blockStorage();
    expect(getSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getPendingPhone()).toBeNull();
    expect(getPendingEmail()).toBeNull();
    expect(isEmailVerified()).toBe(false);
    expect(isPhoneVerified()).toBe(false);
    expect(consumePostAuthRedirect()).toBeNull();

    expect(() => {
      setSession("sam");
      setTokens("a", "r");
      setPendingPhone("+1");
      clearPendingPhone();
      setPendingEmail("a@b.co");
      clearPendingEmail();
      setEmailVerified(true);
      setPhoneVerified(true);
      setPostAuthRedirect("/x/");
      stashPendingCredentials("sam", "pw");
      clearSession();
    }).not.toThrow();
  });
});

describe("the session hooks", () => {
  it("follow sign-in and sign-out", () => {
    const session = renderHook(() => useSession());
    const token = renderHook(() => useAccessToken());
    const auth = renderHook(() => useAuth());
    expect(session.result.current).toBeNull();
    expect(auth.result.current).toEqual({ session: null, isLoaded: true });

    act(() => {
      setTokens("a", "r");
      setSession("sam");
    });
    expect(session.result.current).toBe("sam");
    expect(token.result.current).toBe("a");
    expect(auth.result.current.session).toBe("sam");

    act(() => clearSession());
    expect(session.result.current).toBeNull();
    expect(token.result.current).toBeNull();
  });

  it("follow a change made in another tab", () => {
    const { result } = renderHook(() => useSession());
    act(() => {
      localStorage.setItem(SESSION_COOKIE_NAME, "alex");
      window.dispatchEvent(new StorageEvent("storage"));
    });
    expect(result.current).toBe("alex");
  });

  it("report the verified flags", () => {
    const email = renderHook(() => useEmailVerified());
    const phone = renderHook(() => usePhoneVerified());
    act(() => {
      setEmailVerified(true);
      setPhoneVerified(true);
    });
    expect(email.result.current).toBe(true);
    expect(phone.result.current).toBe(true);
  });
});

describe("clearSession", () => {
  it("forgets everything about the account, the Google session and the enterprise draft", () => {
    signIn();
    setPendingPhone("+1");
    setPendingEmail("a@b.co");
    setEmailVerified(true);
    setPhoneVerified(true);
    saveEnterpriseDraft(DEFAULT_CONFIGURATION);

    clearSession();

    expect(googleLogout).toHaveBeenCalled();
    expect(getSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getPendingPhone()).toBeNull();
    expect(getPendingEmail()).toBeNull();
    expect(isEmailVerified()).toBe(false);
    expect(isPhoneVerified()).toBe(false);
    expect(loadEnterpriseDraft()).toBeNull();
  });

  it("still clears when Google's own sign-out throws", () => {
    vi.mocked(googleLogout).mockImplementation(() => {
      throw new Error("not loaded");
    });
    signIn();
    clearSession();
    expect(getSession()).toBeNull();
  });
});

describe("refreshTokens", () => {
  it("trades the refresh token for a new pair", async () => {
    signIn();
    server({
      "/users/token/refresh/": jsonResponse(200, {
        data: { tokens: { access: "access-2", refresh: "refresh-2" } },
      }),
    });
    expect(await refreshTokens()).toBe(true);
    expect(requestsTo("/users/token/refresh/")[0].body).toEqual({
      refresh: "refresh-1",
    });
    expect(getAccessToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("shares one refresh between callers that ask at once", async () => {
    signIn();
    server({
      "/users/token/refresh/": jsonResponse(200, {
        data: { tokens: { access: "access-2", refresh: "refresh-2" } },
      }),
    });
    const [first, second] = await Promise.all([
      refreshTokens(),
      refreshTokens(),
    ]);
    expect([first, second]).toEqual([true, true]);
    expect(requestsTo("/users/token/refresh/")).toHaveLength(1);

    await refreshTokens();
    expect(requestsTo("/users/token/refresh/")).toHaveLength(2);
  });

  it("fails without a refresh token, on a refusal, a partial pair, or a dead network", async () => {
    expect(await refreshTokens()).toBe(false);
    expect(http).not.toHaveBeenCalled();

    signIn();
    server({ "/users/token/refresh/": jsonResponse(401, {}) });
    expect(await refreshTokens()).toBe(false);

    server({
      "/users/token/refresh/": jsonResponse(200, {
        data: { tokens: { access: "access-2" } },
      }),
    });
    expect(await refreshTokens()).toBe(false);

    server({ "/users/token/refresh/": brokenResponse(200) });
    expect(await refreshTokens()).toBe(false);

    server({ "/users/token/refresh/": new Error("offline") });
    expect(await refreshTokens()).toBe(false);
    expect(getAccessToken()).toBe("access-1");
  });
});

describe("logout", () => {
  it("unregisters push, tells the server, then clears the session", async () => {
    signIn();
    await logout();

    expect(unsubscribeOnLogout).toHaveBeenCalled();
    expect(requestsTo("/users/logout/")[0]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer access-1" },
      body: { refresh: "refresh-1" },
    });
    expect(getSession()).toBeNull();
  });

  it("skips the server when there are no tokens to revoke", async () => {
    localStorage.setItem(SESSION_COOKIE_NAME, "sam");
    await logout();
    expect(http).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
  });

  it("clears the session even when push and the server both fail", async () => {
    signIn();
    vi.mocked(unsubscribeOnLogout).mockRejectedValue(new Error("no worker"));
    server({ "/users/logout/": new Error("offline") });
    await logout();
    expect(getSession()).toBeNull();
  });
});

describe("handleUnauthorizedResponse", () => {
  it("ignores anything that is not a 401", async () => {
    signIn();
    await handleUnauthorizedResponse(jsonResponse(403, {}));
    expect(http).not.toHaveBeenCalled();
    expect(getSession()).toBe("sam");
  });

  it("refreshes rather than signing out, when the refresh works", async () => {
    signIn();
    server({
      "/users/token/refresh/": jsonResponse(200, {
        data: { tokens: { access: "access-2", refresh: "refresh-2" } },
      }),
    });
    await handleUnauthorizedResponse(jsonResponse(401, {}));
    expect(getSession()).toBe("sam");
    expect(getAccessToken()).toBe("access-2");
  });

  it("signs out when the refresh fails, once for concurrent failures", async () => {
    signIn();
    server({ "/users/token/refresh/": jsonResponse(401, {}) });
    await Promise.all([
      handleUnauthorizedResponse(jsonResponse(401, {})),
      handleUnauthorizedResponse(jsonResponse(401, {})),
    ]);
    expect(getSession()).toBeNull();
    expect(requestsTo("/users/logout/")).toHaveLength(1);
  });

  it("signs out straight away when the request was already retried", async () => {
    signIn();
    await handleUnauthorizedResponse(jsonResponse(401, {}), {
      alreadyRetried: true,
    });
    expect(requestsTo("/users/token/refresh/")).toHaveLength(0);
    expect(getSession()).toBeNull();
  });
});

describe("authenticate", () => {
  it("signs in and stores the session", async () => {
    server({
      "/users/login/": jsonResponse(200, {
        data: {
          user: { username: "sam", display_name: "Sam Wren" },
          tokens: { access: "a", refresh: "r" },
        },
      }),
    });
    expect(
      await authenticate({ username: "sam@example.com", password: "pw" }),
    ).toEqual({ ok: true, displayName: "Sam Wren" });
    expect(requestsTo("/users/login/")[0].body).toEqual({
      username: "sam@example.com",
      password: "pw",
    });
    expect(getSession()).toBe("sam");
    expect(getAccessToken()).toBe("a");
  });

  it("falls back to what was typed when the answer names nobody", async () => {
    server({ "/users/login/": jsonResponse(200, {}) });
    expect(await authenticate({ username: "sam", password: "pw" })).toEqual({
      ok: true,
      displayName: "sam",
    });
    expect(getAccessToken()).toBeNull();
  });

  it("reports a refusal, flagging an email that still needs verifying", async () => {
    server({
      "/users/login/": jsonResponse(400, {
        data: { non_field_errors: ["Please verify your email first."] },
      }),
    });
    expect(await authenticate({ username: "sam", password: "pw" })).toEqual({
      ok: false,
      message: "Please verify your email first.",
      emailNotVerified: true,
    });

    server({ "/users/login/": jsonResponse(401, { message: "Nope." }) });
    expect(await authenticate({ username: "sam", password: "pw" })).toEqual({
      ok: false,
      message: "Nope.",
      emailNotVerified: false,
    });

    server({ "/users/login/": brokenResponse(401) });
    expect(
      await authenticate({ username: "sam", password: "pw" }),
    ).toMatchObject({
      message: "Incorrect username or password.",
    });

    server({
      "/users/login/": jsonResponse(400, { data: { detail: "Locked." } }),
    });
    expect(
      await authenticate({ username: "sam", password: "pw" }),
    ).toMatchObject({
      message: "Locked.",
    });

    server({ "/users/login/": jsonResponse(400, { data: { nested: {} } }) });
    expect(
      await authenticate({ username: "sam", password: "pw" }),
    ).toMatchObject({
      message: "Incorrect username or password.",
    });

    server({ "/users/login/": new Error("offline") });
    expect(await authenticate({ username: "sam", password: "pw" })).toEqual(
      NETWORK_ERROR,
    );
  });
});

describe("authenticateWithGoogle", () => {
  it("signs in, and says when the account is new", async () => {
    stubLocation("https://loopdn.com/login/");
    server({
      "/users/google/": jsonResponse(201, {
        data: {
          user: { username: "sam", display_name: "" },
          tokens: { access: "a", refresh: "r" },
        },
      }),
    });
    expect(await authenticateWithGoogle("google-jwt")).toEqual({
      ok: true,
      displayName: "sam",
      isNewAccount: true,
    });
    expect(requestsTo("/users/google/")[0].body).toEqual({
      credential: "google-jwt",
    });
    expect(getSession()).toBe("sam");
  });

  it("asks for a commercial account on the commercial site", async () => {
    stubLocation("https://commercial.loopdn.com/login/");
    server({ "/users/google/": jsonResponse(200, {}) });
    expect(await authenticateWithGoogle("google-jwt")).toEqual({
      ok: true,
      displayName: "",
      isNewAccount: false,
    });
    expect(requestsTo("/users/google/")[0].body).toEqual({
      credential: "google-jwt",
      account_type: "commercial",
    });
  });

  it("reports a refusal and a dead network", async () => {
    server({ "/users/google/": jsonResponse(400, {}) });
    expect(await authenticateWithGoogle("x")).toEqual({
      ok: false,
      message: "Unable to continue with Google. Please try again.",
    });
    server({ "/users/google/": new Error("offline") });
    expect(await authenticateWithGoogle("x")).toEqual(NETWORK_ERROR);
  });
});

describe("registerAccount", () => {
  const payload = {
    username: "sam",
    email: "sam@example.com",
    password: "Str0ng!pass",
    confirmPassword: "Str0ng!pass",
    firstName: "Sam",
    lastName: "Wren",
    displayName: "  ",
    phoneNumber: "+1 (415) 555-2671",
  };

  it("registers, then remembers what the next two pages need", async () => {
    stubLocation("https://loopdn.com/signup/");
    expect(await registerAccount(payload)).toEqual({
      ok: true,
      displayName: "  ",
    });
    expect(requestsTo("/users/register/")[0].body).toEqual({
      username: "sam",
      email: "sam@example.com",
      password: "Str0ng!pass",
      confirm_password: "Str0ng!pass",
      first_name: "Sam",
      last_name: "Wren",
      display_name: "Sam",
      phone_number: "+14155552671",
    });
    expect(getPendingPhone()).toBe("+14155552671");
    expect(getPendingEmail()).toBe("sam@example.com");
    expect(JSON.parse(sessionStorage.getItem(PENDING_LOGIN_KEY)!)).toEqual({
      username: "sam",
      password: "Str0ng!pass",
    });
    // Registration issues no tokens: nobody is signed in yet.
    expect(getSession()).toBeNull();
  });

  it("registers a commercial account without a phone", async () => {
    stubLocation("https://commercial.loopdn.com/signup/");
    setPendingPhone("+1999");
    expect(
      await registerAccount({
        ...payload,
        displayName: undefined,
        phoneNumber: "",
      }),
    ).toEqual({ ok: true, displayName: "sam" });
    expect(requestsTo("/users/register/")[0].body).toMatchObject({
      phone_number: "",
      account_type: "commercial",
    });
    expect(getPendingPhone()).toBeNull();
  });

  it("reports a refusal and a dead network", async () => {
    stubLocation("https://loopdn.com/signup/");
    server({
      "/users/register/": jsonResponse(400, {
        data: { username: ["That username is taken."] },
      }),
    });
    expect(await registerAccount(payload)).toEqual({
      ok: false,
      message: "That username is taken.",
    });
    server({ "/users/register/": jsonResponse(500, null) });
    expect(await registerAccount(payload)).toMatchObject({
      message: "Unable to create your account. Please try again.",
    });
    server({ "/users/register/": new Error("offline") });
    expect(await registerAccount(payload)).toEqual(NETWORK_ERROR);
  });
});

describe("email verification", () => {
  it("resends the code", async () => {
    expect(await resendEmailVerificationCode("sam@example.com")).toEqual({
      ok: true,
      displayName: "sam@example.com",
    });
    expect(requestsTo("/users/resend-code/")[0].body).toEqual({
      email: "sam@example.com",
    });

    server({
      "/users/resend-code/": jsonResponse(429, { message: "Slow down." }),
    });
    expect(await resendEmailVerificationCode("sam@example.com")).toEqual({
      ok: false,
      message: "Slow down.",
    });
    server({ "/users/resend-code/": jsonResponse(500, {}) });
    expect(await resendEmailVerificationCode("x")).toMatchObject({
      message: "Unable to send a verification code. Please try again.",
    });
    server({ "/users/resend-code/": new Error("offline") });
    expect(await resendEmailVerificationCode("x")).toEqual(NETWORK_ERROR);
  });

  it("verifies the code, then signs in with the credentials held from signup", async () => {
    setPendingEmail("sam@example.com");
    stashPendingCredentials("sam", "Str0ng!pass");
    server({
      "/users/login/": jsonResponse(200, {
        data: {
          user: { username: "sam", display_name: "Sam" },
          tokens: { access: "a", refresh: "r" },
        },
      }),
    });

    expect(await verifyEmailCode("sam@example.com", "123456")).toEqual({
      ok: true,
      displayName: "Sam",
    });
    expect(requestsTo("/users/verify-email/")[0].body).toEqual({
      email: "sam@example.com",
      code: "123456",
    });
    expect(isEmailVerified()).toBe(true);
    expect(getPendingEmail()).toBeNull();
    expect(sessionStorage.getItem(PENDING_LOGIN_KEY)).toBeNull();
    expect(getSession()).toBe("sam");
  });

  it("asks for a normal login when the credentials are gone or unreadable", async () => {
    expect(await verifyEmailCode("sam@example.com", "123456")).toEqual({
      ok: false,
      message: "Email verified. Please log in to continue.",
    });
    expect(isEmailVerified()).toBe(true);

    sessionStorage.setItem(PENDING_LOGIN_KEY, "{broken");
    expect(await verifyEmailCode("sam@example.com", "123456")).toMatchObject({
      ok: false,
    });
  });

  it("reports a wrong code and a dead network", async () => {
    server({ "/users/verify-email/": jsonResponse(400, {}) });
    expect(await verifyEmailCode("sam@example.com", "000000")).toEqual({
      ok: false,
      message: "That code didn't work. Please try again.",
    });
    expect(isEmailVerified()).toBe(false);
    server({ "/users/verify-email/": new Error("offline") });
    expect(await verifyEmailCode("sam@example.com", "1")).toEqual(
      NETWORK_ERROR,
    );
  });
});

describe("phone verification", () => {
  it("needs a signed-in account for every step", async () => {
    const message = "You must be signed in to verify a phone number.";
    expect(await updatePhoneNumber("+14155552671")).toEqual({
      ok: false,
      message: "You must be signed in to add a phone number.",
    });
    expect(await requestPhoneVerificationCode("+14155552671")).toEqual({
      ok: false,
      message,
    });
    expect(await verifyPhoneCode("123456")).toEqual({ ok: false, message });
    expect(http).not.toHaveBeenCalled();
  });

  it("saves a phone number, normalised", async () => {
    signIn();
    expect(await updatePhoneNumber("+1 (415) 555-2671")).toEqual({
      ok: true,
      displayName: "+14155552671",
    });
    expect(requestsTo("/users/me/profile/")[0]).toMatchObject({
      method: "PATCH",
      headers: { Authorization: "Bearer access-1" },
      body: { phone_number: "+14155552671" },
    });
    expect(getPendingPhone()).toBe("+14155552671");
  });

  it("requests a code, then verifies it", async () => {
    signIn();
    setPendingPhone("+14155552671");
    expect(await requestPhoneVerificationCode("+1 415 555 2671")).toEqual({
      ok: true,
      displayName: "+14155552671",
    });
    expect(requestsTo("/users/me/phone/request-code/")[0].body).toEqual({
      phone_number: "+14155552671",
    });

    expect(await verifyPhoneCode("123456")).toEqual({
      ok: true,
      displayName: "",
    });
    expect(requestsTo("/users/me/phone/verify/")[0].body).toEqual({
      code: "123456",
    });
    expect(isPhoneVerified()).toBe(true);
    expect(getPendingPhone()).toBeNull();
  });

  it("reports each refusal in its own words", async () => {
    signIn();
    server({
      "/users/me/profile/": jsonResponse(400, {}),
      "/users/me/phone/request-code/": jsonResponse(400, {}),
      "/users/me/phone/verify/": jsonResponse(400, {}),
    });
    expect(await updatePhoneNumber("+1")).toMatchObject({
      message: "Unable to save that phone number. Please try again.",
    });
    expect(await requestPhoneVerificationCode("+1")).toMatchObject({
      message: "Unable to send a verification code. Please try again.",
    });
    expect(await verifyPhoneCode("0")).toMatchObject({
      message: "That code didn't work. Please try again.",
    });
    expect(isPhoneVerified()).toBe(false);

    server({
      "/users/me/profile/": new Error("offline"),
      "/users/me/phone/request-code/": new Error("offline"),
      "/users/me/phone/verify/": new Error("offline"),
    });
    expect(await updatePhoneNumber("+1")).toEqual(NETWORK_ERROR);
    expect(await requestPhoneVerificationCode("+1")).toEqual(NETWORK_ERROR);
    expect(await verifyPhoneCode("0")).toEqual(NETWORK_ERROR);
  });

  it("signs out on a 401 it cannot refresh past", async () => {
    signIn();
    server({
      "/users/me/phone/verify/": jsonResponse(401, { message: "Expired." }),
      "/users/token/refresh/": jsonResponse(401, {}),
    });
    expect(await verifyPhoneCode("123456")).toEqual({
      ok: false,
      message: "Expired.",
    });
    expect(getSession()).toBeNull();
  });
});

describe("fetchUserProfile", () => {
  it("reads the profile", async () => {
    signIn();
    server({
      "/users/me/": jsonResponse(200, {
        data: {
          username: "sam",
          email: "sam@example.com",
          profile: {
            display_name: "Sam Wren",
            phone_number: "+14155552671",
            email_verified: true,
            phone_no_verified: false,
            email_enabled: true,
            bio: "Hi.",
            avatar_url: "https://cdn/sam.png",
          },
        },
      }),
    });
    expect(await fetchUserProfile()).toEqual({
      ok: true,
      displayName: "Sam Wren",
      username: "sam",
      email: "sam@example.com",
      phone: "+14155552671",
      emailVerified: true,
      phoneVerified: false,
      emailEnabled: true,
      bio: "Hi.",
      avatarUrl: "https://cdn/sam.png",
    });
    expect(requestsTo("/users/me/")[0].headers).toEqual({
      Authorization: "Bearer access-1",
    });
  });

  it("builds a name from first and last when the profile has none", async () => {
    signIn();
    server({
      "/users/me/": jsonResponse(200, {
        data: { first_name: "Sam", last_name: "Wren", profile: {} },
      }),
    });
    expect(await fetchUserProfile()).toMatchObject({
      ok: true,
      displayName: "Sam Wren",
    });
  });

  it("needs a session, and reports a refusal or a dead network", async () => {
    expect(await fetchUserProfile()).toEqual({
      ok: false,
      message: "You must be signed in to load your profile.",
    });

    signIn();
    server({ "/users/me/": jsonResponse(500, {}) });
    expect(await fetchUserProfile()).toEqual({
      ok: false,
      message: "Unable to load your profile.",
    });
    server({ "/users/me/": new Error("offline") });
    expect(await fetchUserProfile()).toEqual(NETWORK_ERROR);
  });
});

describe("updateUserProfile", () => {
  it("patches the name, bio and email setting as JSON", async () => {
    signIn();
    server({
      "/users/me/profile/": jsonResponse(200, {
        data: {
          display_name: "Sam W.",
          bio: "Hello.",
          avatar_url: "https://cdn/new.png",
          phone_number: "+1555",
          email_verified: true,
          phone_no_verified: true,
          email_enabled: false,
        },
      }),
    });

    expect(
      await updateUserProfile({
        displayName: "Sam W",
        bio: "Hello",
        emailEnabled: false,
        email: "sam@example.com",
        username: "sam",
      }),
    ).toEqual({
      ok: true,
      displayName: "Sam W.",
      email: "sam@example.com",
      phone: "+1555",
      bio: "Hello.",
      avatarUrl: "https://cdn/new.png",
      emailVerified: true,
      phoneVerified: true,
      emailEnabled: false,
      username: "sam",
    });
    expect(requestsTo("/users/me/profile/")[0]).toMatchObject({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer access-1",
      },
      body: { display_name: "Sam W", bio: "Hello", email_enabled: false },
    });
  });

  it("uploads a new avatar as a form, leaving the content type to the browser", async () => {
    signIn();
    const avatarFile = new File(["png"], "me.png", { type: "image/png" });
    await updateUserProfile({
      displayName: "Sam",
      bio: "Hi",
      emailEnabled: true,
      avatarFile,
    });

    const request = requestsTo("/users/me/profile/")[0];
    expect(request.headers).toEqual({ Authorization: "Bearer access-1" });
    const form = request.raw as FormData;
    expect(form.get("display_name")).toBe("Sam");
    expect(form.get("bio")).toBe("Hi");
    expect(form.get("email_enabled")).toBe("true");
    expect(form.get("avatar")).toBeInstanceOf(File);

    await updateUserProfile({ avatarFile });
    const bare = requestsTo("/users/me/profile/")[1].raw as FormData;
    expect([...bare.keys()]).toEqual(["avatar"]);
  });

  it("keeps what was sent when the server echoes nothing back", async () => {
    signIn();
    server({ "/users/me/profile/": brokenResponse(200) });
    expect(
      await updateUserProfile({
        displayName: "Sam",
        phone: "+1555",
        avatarUrl: "https://cdn/old.png",
        emailVerified: true,
        phoneVerified: false,
      }),
    ).toMatchObject({
      ok: true,
      displayName: "Sam",
      phone: "+1555",
      avatarUrl: "https://cdn/old.png",
      emailVerified: true,
      phoneVerified: false,
    });
  });

  it("needs a session, and reports a refusal or a dead network", async () => {
    expect(await updateUserProfile({ displayName: "Sam" })).toEqual({
      ok: false,
      message: "You must be signed in to update your profile.",
    });

    signIn();
    server({
      "/users/me/profile/": jsonResponse(400, {
        data: { display_name: "Too long." },
      }),
    });
    expect(await updateUserProfile({ displayName: "x" })).toEqual({
      ok: false,
      message: "Too long.",
    });
    server({ "/users/me/profile/": jsonResponse(500, {}) });
    expect(await updateUserProfile({})).toMatchObject({
      message: "Unable to update your profile.",
    });
    server({ "/users/me/profile/": new Error("offline") });
    expect(await updateUserProfile({})).toEqual(NETWORK_ERROR);
  });
});

describe("passwords", () => {
  it("never reveals whether an email has an account", async () => {
    server({ "/users/forgot-password/": jsonResponse(404, {}) });
    expect(await requestPasswordReset("nobody@example.com")).toEqual({
      ok: true,
    });
    expect(requestsTo("/users/forgot-password/")[0].body).toEqual({
      email: "nobody@example.com",
    });

    server({ "/users/forgot-password/": jsonResponse(500, {}) });
    expect(await requestPasswordReset("x")).toEqual({ ok: false });
    server({ "/users/forgot-password/": new Error("offline") });
    expect(await requestPasswordReset("x")).toEqual({ ok: false });
  });

  it("resets a password from the emailed link", async () => {
    expect(
      await resetPassword({
        uid: "u1",
        token: "t1",
        newPassword: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }),
    ).toEqual({ ok: true });
    expect(requestsTo("/users/reset-password/")[0].body).toEqual({
      uid: "u1",
      token: "t1",
      new_password: "Str0ng!pass",
      confirm_password: "Str0ng!pass",
    });
  });

  it("tells an expired link apart from a rejected password", async () => {
    const payload = {
      uid: "u",
      token: "t",
      newPassword: "a",
      confirmPassword: "a",
    };

    server({
      "/users/reset-password/": jsonResponse(400, {
        data: { token: ["This link has expired."], extra: [1, "kept"] },
      }),
    });
    expect(await resetPassword(payload)).toEqual({
      ok: false,
      message: "This link has expired.",
      fieldErrors: { token: ["This link has expired."], extra: ["kept"] },
      invalidOrExpired: true,
    });

    server({
      "/users/reset-password/": jsonResponse(400, {
        data: { new_password: "Too common.", ignored: [], nested: {} },
      }),
    });
    expect(await resetPassword(payload)).toEqual({
      ok: false,
      message: "Too common.",
      fieldErrors: { new_password: ["Too common."] },
      invalidOrExpired: false,
    });

    server({ "/users/reset-password/": jsonResponse(400, { data: ["odd"] }) });
    expect(await resetPassword(payload)).toEqual({
      ok: false,
      message: "Unable to reset your password. Please try again.",
      fieldErrors: {},
      invalidOrExpired: false,
    });

    server({ "/users/reset-password/": brokenResponse(500) });
    expect(await resetPassword(payload)).toMatchObject({ fieldErrors: {} });

    server({ "/users/reset-password/": new Error("offline") });
    expect(await resetPassword(payload)).toEqual({
      ...NETWORK_ERROR,
      fieldErrors: {},
      invalidOrExpired: false,
    });
  });

  it("changes a password for a signed-in account", async () => {
    const payload = { oldPassword: "old", newPassword: "Str0ng!pass" };
    expect(await changePassword(payload)).toEqual({
      ok: false,
      message: "You must be signed in to change your password.",
      fieldErrors: {},
    });

    signIn();
    expect(await changePassword(payload)).toEqual({ ok: true });
    expect(requestsTo("/users/change-password/")[0]).toMatchObject({
      headers: { Authorization: "Bearer access-1" },
      body: { old_password: "old", new_password: "Str0ng!pass" },
    });

    server({
      "/users/change-password/": jsonResponse(400, {
        data: { old_password: ["That is not your current password."] },
      }),
    });
    expect(await changePassword(payload)).toEqual({
      ok: false,
      message: "That is not your current password.",
      fieldErrors: { old_password: ["That is not your current password."] },
    });

    server({ "/users/change-password/": jsonResponse(500, {}) });
    expect(await changePassword(payload)).toMatchObject({
      message: "Unable to change your password. Please try again.",
    });

    server({ "/users/change-password/": new Error("offline") });
    expect(await changePassword(payload)).toEqual({
      ...NETWORK_ERROR,
      fieldErrors: {},
    });
  });
});

describe("fetchCurrentUser", () => {
  it("refreshes the cached verified flags, wherever the server puts them", async () => {
    signIn();
    server({
      "/users/me/": jsonResponse(200, {
        data: { phone_no_verified: true, email_verified: true },
      }),
    });
    await fetchCurrentUser();
    expect([isPhoneVerified(), isEmailVerified()]).toEqual([true, true]);

    server({
      "/users/me/": jsonResponse(200, {
        data: { profile: { phone_no_verified: false, email_verified: true } },
      }),
    });
    await fetchCurrentUser();
    expect([isPhoneVerified(), isEmailVerified()]).toEqual([false, true]);

    server({ "/users/me/": brokenResponse(200) });
    await fetchCurrentUser();
    expect([isPhoneVerified(), isEmailVerified()]).toEqual([false, false]);
  });

  it("does nothing signed out, and leaves the flags alone on failure", async () => {
    await fetchCurrentUser();
    expect(http).not.toHaveBeenCalled();

    signIn();
    setPhoneVerified(true);
    server({ "/users/me/": jsonResponse(500, {}) });
    await fetchCurrentUser();
    expect(isPhoneVerified()).toBe(true);

    server({ "/users/me/": new Error("offline") });
    await expect(fetchCurrentUser()).resolves.toBeUndefined();
    expect(isPhoneVerified()).toBe(true);
  });
});
