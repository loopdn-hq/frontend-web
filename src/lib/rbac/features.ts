/**
 * What this account may reach, as the server sees it.
 *
 * THIS DECIDES WHAT TO SHOW, NOT WHAT IS ALLOWED. Every write is re-checked
 * server-side, and the queryset there is what decides whether an object is
 * reachable at all. Hiding a control the viewer cannot use is a courtesy; a
 * server that trusted this would be broken.
 *
 * Account-axis features only. What somebody may do inside one conversation
 * rides inline on that conversation (`features` on ConversationSerializer),
 * because the list already carries everything else the UI needs.
 */
import { authorizedRequest } from "@/lib/chat/conversations";

export type AccountFeatures = ReadonlySet<string>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fetch the signed-in account's features.
 *
 * Returns an EMPTY set on any failure rather than throwing. A menu that
 * renders nothing is a bad afternoon; a menu that throws is a blank page, and
 * the one thing this must never do is take down a screen because a
 * nice-to-have request failed.
 */
export async function fetchAccountFeatures(): Promise<AccountFeatures> {
  try {
    const response = await authorizedRequest("/users/me/features/");
    if (!response.ok) return new Set();

    const payload: unknown = await response.json().catch(() => null);
    if (!isObject(payload) || !isObject(payload.data)) return new Set();

    const account = payload.data.account;
    if (!Array.isArray(account)) return new Set();

    return new Set(
      account.filter((key): key is string => typeof key === "string"),
    );
  } catch {
    return new Set();
  }
}
