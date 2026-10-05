import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  allows,
  fetchAccountFeatures,
  fetchPermissionsMatrix,
  GROUP,
  meets,
  setGrant,
  useFeatures,
} from "@/lib/rbac";
import { brokenResponse, jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("allows", () => {
  it("reads the features the server already resolved", () => {
    const conversation = { features: [GROUP.send, GROUP.pin] };
    expect(allows(conversation, GROUP.pin)).toBe(true);
    expect(allows(conversation, GROUP.deleteAny)).toBe(false);
  });

  it("allows nothing before the server has answered", () => {
    expect(allows({}, GROUP.send)).toBe(false);
    expect(allows(null, GROUP.send)).toBe(false);
    expect(allows(undefined, GROUP.send)).toBe(false);
  });
});

describe("meets", () => {
  const loaded = { features: new Set(["commercial.access"]), loading: false };

  it("shows anything that asks for nothing", () => {
    expect(meets(undefined, loaded)).toBe(true);
    expect(meets({}, loaded)).toBe(true);
  });

  it("hides the unreleased whatever the account has", () => {
    expect(meets({ unreleased: true }, loaded)).toBe(false);
    expect(
      meets({ unreleased: true, account: "commercial.access" }, loaded),
    ).toBe(false);
  });

  it("opens a feature gate only once the answer is in and says yes", () => {
    expect(meets({ account: "commercial.access" }, loaded)).toBe(true);
    expect(meets({ account: "admin.access" }, loaded)).toBe(false);
    expect(
      meets({ account: "commercial.access" }, { ...loaded, loading: true }),
    ).toBe(false);
  });
});

describe("fetchAccountFeatures", () => {
  it("returns the account's feature keys, dropping anything that is not one", async () => {
    respond(200, { data: { account: ["commercial.access", 7, null, "x"] } });
    const features = await fetchAccountFeatures();
    expect([...features]).toEqual(["commercial.access", "x"]);
    expect(authorizedRequest).toHaveBeenCalledWith("/users/me/features/");
  });

  it("returns nothing, rather than throwing, on every kind of failure", async () => {
    respond(500, {});
    expect((await fetchAccountFeatures()).size).toBe(0);

    respond(200, { data: "nope" });
    expect((await fetchAccountFeatures()).size).toBe(0);

    respond(200, { data: { account: "all" } });
    expect((await fetchAccountFeatures()).size).toBe(0);

    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(200));
    expect((await fetchAccountFeatures()).size).toBe(0);

    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect((await fetchAccountFeatures()).size).toBe(0);
  });
});

describe("useFeatures", () => {
  it("is loading until the features arrive", async () => {
    respond(200, { data: { account: ["admin.access"] } });
    const { result } = renderHook(() => useFeatures());
    expect(result.current.loading).toBe(true);
    expect(result.current.features.size).toBe(0);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.features.has("admin.access")).toBe(true);
  });

  it("ignores an answer that lands after unmount", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(authorizedRequest).mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useFeatures());
    unmount();
    finish(jsonResponse(200, { data: { account: ["admin.access"] } }));
    await Promise.resolve();
    expect(result.current.loading).toBe(true);
  });
});

const AXES = [
  {
    axis: "account",
    label: "Account",
    roles: ["admin", "member", 3],
    areas: [
      {
        area: "Commercial",
        features: [
          {
            key: "commercial.access",
            label: "Use the dashboard",
            description: "Open the commercial site.",
            locked: true,
            grants: { admin: true, member: false, guest: "maybe" },
          },
          { key: "bare.feature" },
          { label: "no key" },
          "junk",
        ],
      },
      { area: "Empty" },
      { features: [] },
      null,
    ],
  },
  { axis: "group" },
  { label: "no axis" },
];

describe("fetchPermissionsMatrix", () => {
  it("reads the matrix, keeping an unwritten grant distinct from a denial", async () => {
    respond(200, { data: { axes: AXES } });
    const result = await fetchPermissionsMatrix();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.matrix.axes.map((axis) => axis.axis)).toEqual([
      "account",
      "group",
    ]);
    const [account, group] = result.matrix.axes;
    expect(account.roles).toEqual(["admin", "member"]);
    expect(account.areas.map((area) => area.area)).toEqual([
      "Commercial",
      "Empty",
    ]);
    expect(account.areas[0].features).toEqual([
      {
        key: "commercial.access",
        label: "Use the dashboard",
        description: "Open the commercial site.",
        locked: true,
        grants: { admin: true, member: false, guest: null },
      },
      {
        key: "bare.feature",
        label: "bare.feature",
        description: "",
        locked: false,
        grants: {},
      },
    ]);
    expect(account.areas[1].features).toEqual([]);
    expect(group).toEqual({
      axis: "group",
      label: "group",
      roles: [],
      areas: [],
    });
  });

  it("treats a payload with no axes as an empty matrix", async () => {
    respond(200, { data: {} });
    const result = await fetchPermissionsMatrix();
    expect(result).toEqual({ ok: true, matrix: { axes: [] } });
  });

  it("explains a 403, and says something for everything else", async () => {
    respond(403, {});
    expect(await fetchPermissionsMatrix()).toEqual({
      ok: false,
      message: "You need the account admin role to view permissions.",
    });

    respond(500, {});
    expect(await fetchPermissionsMatrix()).toEqual({
      ok: false,
      message: "Could not load the permissions matrix.",
    });

    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(200));
    expect(await fetchPermissionsMatrix()).toMatchObject({ ok: false });

    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await fetchPermissionsMatrix()).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });
});

describe("setGrant", () => {
  const change = {
    feature: "commercial.access",
    role: "member",
    allowed: true,
  };

  it("posts one cell and returns the rebuilt matrix", async () => {
    respond(200, { data: { axes: AXES } });
    const result = await setGrant({ ...change, note: "asked for it" });

    expect(authorizedRequest).toHaveBeenCalledWith("/rbac/matrix/set/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...change, note: "asked for it" }),
    });
    expect(result.ok && result.matrix.axes).toHaveLength(2);
  });

  it("returns an empty matrix when the answer carries no axes", async () => {
    respond(200, { data: {} });
    expect(await setGrant(change)).toEqual({ ok: true, matrix: { axes: [] } });
  });

  it("shows the server's sentence for a refusal", async () => {
    respond(400, { message: "That feature is locked." });
    expect(await setGrant(change)).toEqual({
      ok: false,
      message: "That feature is locked.",
    });

    respond(400, {});
    expect(await setGrant(change)).toEqual({
      ok: false,
      message: "Could not change that permission.",
    });
  });

  it("covers a 403, a malformed success and a dead network", async () => {
    respond(403, { message: "ignored" });
    expect(await setGrant(change)).toEqual({
      ok: false,
      message: "You do not have permission to change the matrix.",
    });

    respond(200, { data: [] });
    expect(await setGrant(change)).toEqual({
      ok: false,
      message: "Could not change that permission.",
    });

    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await setGrant(change)).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });
});
