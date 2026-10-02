// One way to call the backend for every area that has its own API module -
// lib/commercial/api.ts, lib/admin/api.ts: the request, unwrapped from the
// {code, message, data} envelope, and the helpers that read a response
// without trusting its shape.
//
// `authorizedRequest` lives in lib/chat for historical reasons; it is the
// app's one authenticated fetch (bearer token, refresh on 401).

import { authorizedRequest } from "@/lib/chat/conversations";

export type ApiObject = Record<string, unknown>;

/**
 * What every call resolves to. Never throws.
 *
 * `fieldErrors` is the server's per-field message, keyed by the API's field
 * name (`contact_email`), when it refused a form.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function isObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * A list endpoint's rows. DRF's PageNumberPagination is on by default, so a
 * list arrives as `{ count, next, previous, results }`; a bare array is
 * accepted too, for a viewset that turns pagination off.
 */
export function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isObject(data) && Array.isArray(data.results)) return data.results;
  return [];
}

/** A page's total and whether there is another, from DRF's pagination. */
export function pageInfo(data: unknown, shown: number) {
  const page = isObject(data) ? data : {};
  return {
    count: asNumber(page.count, shown),
    hasMore: typeof page.next === "string" && page.next !== "",
  };
}

/**
 * A refused form's errors, one sentence per field: DRF sends
 * `{ "contact_email": ["Enter a valid email address."] }` under `data`.
 */
export function fieldErrorsOf(
  data: unknown,
): Record<string, string> | undefined {
  if (!isObject(data)) return undefined;
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(data)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") errors[field] = first;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * One request to `/api/v1{path}`, unwrapped from the {code, message, data}
 * envelope.
 *
 * The server's `message` is shown as-is on failure: EnvelopeJSONRenderer
 * already turns a validation error into a sentence.
 */
export async function apiRequest(
  path: string,
  init: RequestInit = {},
  fallback: string,
): Promise<ApiResult<unknown>> {
  try {
    const response = await authorizedRequest(path, init);
    // A delete answers 204, with nothing to read.
    if (response.status === 204) return { ok: true, data: null };
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isObject(payload)) {
      const message = isObject(payload) ? asText(payload.message) : "";
      return {
        ok: false,
        message: message || fallback,
        fieldErrors: isObject(payload)
          ? fieldErrorsOf(payload.data)
          : undefined,
      };
    }

    return { ok: true, data: payload.data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : fallback,
    };
  }
}

export function jsonBody(body: ApiObject): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
