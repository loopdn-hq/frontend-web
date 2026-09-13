"use client";

import { authorizedRequest } from "@/lib/chat/conversations";

/**
 * People you have blocked.
 *
 * The list is yours alone. There is no route that reads somebody else's, by
 * design: nothing anywhere tells one person that another has blocked them, so
 * there is nothing here that could.
 *
 * A block names either an account or a bare phone number - most members of
 * most groups have no account - which is why `username` and `phoneNumber` are
 * each optional and exactly one of them is set.
 */
export type BlockedEntry = {
  id: number;
  /** The name to show. Falls back to the number for an account-less block. */
  label: string;
  username: string | null;
  phoneNumber: string | null;
  blockedAt: string | null;
};

type ApiBlockedEntry = {
  id: number;
  username: string | null;
  display_label: string | null;
  phone_number: string | null;
  created_at: string | null;
};

function normalize(row: ApiBlockedEntry): BlockedEntry {
  return {
    id: row.id,
    label: row.display_label || row.username || row.phone_number || "Unknown",
    username: row.username,
    phoneNumber: row.phone_number,
    blockedAt: row.created_at,
  };
}

export async function fetchBlockedUsers(): Promise<
  { ok: true; blocked: BlockedEntry[] } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest("/users/me/blocks/");
    const body = (await response.json().catch(() => null)) as {
      data?: ApiBlockedEntry[];
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message: body?.message ?? "Could not load your blocked list.",
      };
    }
    return { ok: true, blocked: (body?.data ?? []).map(normalize) };
  } catch (error) {
    return { ok: false, message: reasonFor(error) };
  }
}

/**
 * Undo one block. Answers the same whether or not there was anything to undo.
 *
 * Named by whichever identity the block carries, because that is what the
 * server matches on: unblocking an account by its number would find nothing.
 */
export async function unblockUser(
  entry: Pick<BlockedEntry, "username" | "phoneNumber">,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = entry.username
    ? { username: entry.username }
    : { phone_number: entry.phoneNumber };

  try {
    const response = await authorizedRequest("/users/me/blocks/remove/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      return { ok: false, message: body?.message ?? "Could not unblock them." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: reasonFor(error) };
  }
}

/**
 * `authorizedRequest` throws its own message when there is no session at all,
 * which is truer than calling that a network error.
 */
function reasonFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Network error. Please try again.";
}
