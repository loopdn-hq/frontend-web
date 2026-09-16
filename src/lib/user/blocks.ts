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
 * Who a block is against: an account, or a bare number. Never both.
 *
 * The same shape a `BlockedEntry` already carries, so a row from the list can
 * be handed straight back to `unblockUser` without being taken apart.
 */
export type BlockTarget = Pick<BlockedEntry, "username" | "phoneNumber">;

/**
 * Block one person. Idempotent: blocking somebody already blocked is fine.
 *
 * Stops direct messages both ways and stops either of you adding the other to
 * a group. It does NOT touch a group you already share - you both stay members
 * and both still see each other's messages there.
 */
export async function blockUser(
  target: BlockTarget,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return changeBlock("add", target, "Could not block them.");
}

/**
 * Undo one block. Answers the same whether or not there was anything to undo.
 */
export async function unblockUser(
  entry: BlockTarget,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return changeBlock("remove", entry, "Could not unblock them.");
}

/**
 * The half the two share. Both name the person the same way and read the same
 * refusal back; only the route and the fallback wording differ.
 *
 * Named by whichever identity the block carries, because that is what the
 * server matches on: unblocking an account by its number would find nothing.
 */
async function changeBlock(
  route: "add" | "remove",
  target: BlockTarget,
  fallbackMessage: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = target.username
    ? { username: target.username }
    : { phone_number: target.phoneNumber };

  try {
    const response = await authorizedRequest(`/users/me/blocks/${route}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      return { ok: false, message: body?.message ?? fallbackMessage };
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
