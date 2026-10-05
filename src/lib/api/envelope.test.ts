import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  apiRequest,
  asNullableNumber,
  asNullableText,
  asNumber,
  asText,
  fieldErrorsOf,
  isObject,
  isPresent,
  jsonBody,
  pageInfo,
  rowsOf,
} from "@/lib/api/envelope";
import { authorizedRequest } from "@/lib/chat/conversations";
import { brokenResponse, jsonResponse } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reading a value without trusting its shape", () => {
  it("only calls a plain object an object", () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject("text")).toBe(false);
  });

  it("falls back when the type is wrong", () => {
    expect(asText("a")).toBe("a");
    expect(asText(1)).toBe("");
    expect(asText(undefined, "fallback")).toBe("fallback");

    expect(asNumber(3)).toBe(3);
    expect(asNumber("3")).toBe(0);
    expect(asNumber(Number.NaN, 9)).toBe(9);
    expect(asNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("keeps 'not set' apart from zero and from empty", () => {
    expect(asNullableNumber(0)).toBe(0);
    expect(asNullableNumber("0")).toBeNull();
    expect(asNullableNumber(Number.NaN)).toBeNull();
    expect(asNullableText("x")).toBe("x");
    expect(asNullableText("")).toBeNull();
    expect(asNullableText(4)).toBeNull();
    expect([1, null, 2].filter(isPresent)).toEqual([1, 2]);
  });
});

describe("lists", () => {
  it("takes rows from a paginated list or a bare array", () => {
    expect(rowsOf({ count: 2, results: [1, 2] })).toEqual([1, 2]);
    expect(rowsOf([3])).toEqual([3]);
    expect(rowsOf({ results: "no" })).toEqual([]);
    expect(rowsOf(null)).toEqual([]);
  });

  it("reads the total and whether there is more", () => {
    expect(pageInfo({ count: 40, next: "https://api/x?page=2" }, 20)).toEqual({
      count: 40,
      hasMore: true,
    });
    expect(pageInfo({ next: "" }, 5)).toEqual({ count: 5, hasMore: false });
    expect(pageInfo([1, 2], 2)).toEqual({ count: 2, hasMore: false });
  });
});

describe("fieldErrorsOf", () => {
  it("takes one sentence per field, from a list or a string", () => {
    expect(
      fieldErrorsOf({
        contact_email: ["Enter a valid email address.", "Second."],
        name: "Too long.",
        nested: { not: "a sentence" },
        empty: [],
      }),
    ).toEqual({
      contact_email: "Enter a valid email address.",
      name: "Too long.",
    });
  });

  it("is undefined when there is nothing to show", () => {
    expect(fieldErrorsOf({ nested: {} })).toBeUndefined();
    expect(fieldErrorsOf("oops")).toBeUndefined();
  });
});

describe("apiRequest", () => {
  it("unwraps the envelope on success", async () => {
    vi.mocked(authorizedRequest).mockResolvedValue(
      jsonResponse(200, { code: 0, message: "ok", data: { id: 4 } }),
    );
    const result = await apiRequest("/things/", { method: "GET" }, "Failed.");
    expect(result).toEqual({ ok: true, data: { id: 4 } });
    expect(authorizedRequest).toHaveBeenCalledWith("/things/", {
      method: "GET",
    });
  });

  it("answers a 204 without trying to read a body", async () => {
    const json = vi.fn();
    vi.mocked(authorizedRequest).mockResolvedValue({
      ok: true,
      status: 204,
      json,
    } as unknown as Response);
    expect(await apiRequest("/things/4/", undefined, "Failed.")).toEqual({
      ok: true,
      data: null,
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("shows the server's message and its field errors on a refusal", async () => {
    vi.mocked(authorizedRequest).mockResolvedValue(
      jsonResponse(400, {
        message: "Please fix the form.",
        data: { name: ["This field is required."] },
      }),
    );
    expect(await apiRequest("/things/", {}, "Failed.")).toEqual({
      ok: false,
      message: "Please fix the form.",
      fieldErrors: { name: "This field is required." },
    });
  });

  it("uses the fallback when the server says nothing usable", async () => {
    vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(500, {}));
    expect(await apiRequest("/things/", {}, "Failed.")).toEqual({
      ok: false,
      message: "Failed.",
      fieldErrors: undefined,
    });

    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(200));
    expect(await apiRequest("/things/", {}, "Failed.")).toEqual({
      ok: false,
      message: "Failed.",
      fieldErrors: undefined,
    });
  });

  it("never throws: a thrown error becomes its message, anything else the fallback", async () => {
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
    expect(await apiRequest("/things/", {}, "Failed.")).toEqual({
      ok: false,
      message: "Signed out.",
    });

    vi.mocked(authorizedRequest).mockRejectedValue("a string");
    expect(await apiRequest("/things/", {}, "Failed.")).toEqual({
      ok: false,
      message: "Failed.",
    });
  });
});

describe("jsonBody", () => {
  it("serialises a body and labels it as JSON", () => {
    expect(jsonBody({ name: "Acme" })).toEqual({
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Acme"}',
    });
  });
});
