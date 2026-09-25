/**
 * The permissions matrix: what each role may use.
 *
 * Read-only. Editing arrives with step 8 and needs locked features enforced on
 * write, a last-admin guard and a per-cell audit trail - without those an
 * editable matrix is the privilege-escalation path `locked` exists to prevent.
 */
import { authorizedRequest } from "@/lib/chat/conversations";

/**
 * `true` allowed, `false` denied, `null` NO CELL AT ALL.
 *
 * Null denies exactly like false at runtime, but it means something different:
 * nobody wrote that grant down. The server warns about it (rbac.W002) and the
 * screen renders it distinctly, because an oversight and a decision should not
 * look the same.
 */
export type Grant = boolean | null;

export type MatrixFeature = {
  key: string;
  label: string;
  description: string;
  /** Never grantable below account admin, whatever the matrix says. */
  locked: boolean;
  grants: Record<string, Grant>;
};

export type MatrixArea = {
  area: string;
  features: MatrixFeature[];
};

export type MatrixAxis = {
  axis: string;
  label: string;
  roles: string[];
  areas: MatrixArea[];
};

export type PermissionsMatrix = {
  axes: MatrixAxis[];
};

export type MatrixResult =
  { ok: true; matrix: PermissionsMatrix } | { ok: false; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asGrant(value: unknown): Grant {
  return typeof value === "boolean" ? value : null;
}

function normalizeFeature(value: unknown): MatrixFeature | null {
  if (!isObject(value) || typeof value.key !== "string") return null;

  const grants: Record<string, Grant> = {};
  if (isObject(value.grants)) {
    for (const [role, allowed] of Object.entries(value.grants)) {
      grants[role] = asGrant(allowed);
    }
  }

  return {
    key: value.key,
    label: typeof value.label === "string" ? value.label : value.key,
    description: typeof value.description === "string" ? value.description : "",
    locked: value.locked === true,
    grants,
  };
}

function normalizeAxis(value: unknown): MatrixAxis | null {
  if (!isObject(value) || typeof value.axis !== "string") return null;

  const roles = Array.isArray(value.roles)
    ? value.roles.filter((role): role is string => typeof role === "string")
    : [];

  const areas: MatrixArea[] = [];
  if (Array.isArray(value.areas)) {
    for (const raw of value.areas) {
      if (!isObject(raw) || typeof raw.area !== "string") continue;
      const features = Array.isArray(raw.features)
        ? raw.features
            .map(normalizeFeature)
            .filter((f): f is MatrixFeature => f !== null)
        : [];
      areas.push({ area: raw.area, features });
    }
  }

  return {
    axis: value.axis,
    label: typeof value.label === "string" ? value.label : value.axis,
    roles,
    areas,
  };
}

export async function fetchPermissionsMatrix(): Promise<MatrixResult> {
  try {
    const response = await authorizedRequest("/rbac/matrix/");
    const payload: unknown = await response.json().catch(() => null);

    if (response.status === 403) {
      return {
        ok: false,
        message: "You need the account admin role to view permissions.",
      };
    }
    if (!response.ok || !isObject(payload) || !isObject(payload.data)) {
      return { ok: false, message: "Could not load the permissions matrix." };
    }

    const axes = Array.isArray(payload.data.axes)
      ? payload.data.axes
          .map(normalizeAxis)
          .filter((a): a is MatrixAxis => a !== null)
      : [];

    return { ok: true, matrix: { axes } };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export type SetGrantResult =
  { ok: true; matrix: PermissionsMatrix } | { ok: false; message: string };

function errorMessage(payload: unknown, fallback: string): string {
  if (isObject(payload) && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

/**
 * Change one cell, and get the whole matrix back.
 *
 * One cell per call: a bulk write would have to decide what happens when the
 * third of twenty changes is refused, and "some of your edits applied" is the
 * worst answer a permissions screen can give.
 *
 * The server returns the rebuilt matrix rather than the cell, so the screen
 * never has to guess what a change implied. A refusal comes back as 400 with a
 * sentence worth showing - locked features and the last-admin guard both land
 * there - and 403 means the caller cannot edit at all.
 */
export async function setGrant(input: {
  feature: string;
  role: string;
  allowed: boolean;
  note?: string;
}): Promise<SetGrantResult> {
  try {
    const response = await authorizedRequest("/rbac/matrix/set/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (response.status === 403) {
      return {
        ok: false,
        message: "You do not have permission to change the matrix.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        message: errorMessage(payload, "Could not change that permission."),
      };
    }
    if (!isObject(payload) || !isObject(payload.data)) {
      return { ok: false, message: "Could not change that permission." };
    }

    const axes = Array.isArray(payload.data.axes)
      ? payload.data.axes
          .map(normalizeAxis)
          .filter((a): a is MatrixAxis => a !== null)
      : [];

    return { ok: true, matrix: { axes } };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}
