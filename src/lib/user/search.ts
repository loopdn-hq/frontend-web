"use client";

import { authorizedRequest } from "@/lib/chat/conversations";

/**
 * Somebody you could start a conversation with.
 *
 * What `GET /users/search/` is allowed to say about another account and no
 * more: a name, a handle and a picture. No number, no email - those are
 * contact details, and the server's PublicProfileSerializer leaves them out.
 */
export type UserSearchResult = {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
};

/** The server returns nothing below this, so the client does not ask. */
export const MIN_USER_SEARCH_LENGTH = 2;

type ApiUser = {
  id: number | string;
  username?: string;
  profile?: { display_label?: string | null; avatar_url?: string | null };
};

/**
 * Accounts whose USERNAME starts with `term`, or whose verified number is
 * exactly `term` when it starts with "+".
 *
 * Username prefix and exact number only - not display names, not partial
 * numbers - and that is the server's rule, not a gap here. A prefix search
 * over numbers would let anyone walk the directory a digit at a time. People
 * you have blocked, and people who blocked you, never appear.
 *
 * One page (20). `hasMore` says there were more, so the caller can ask the
 * person to keep typing rather than paging through a directory.
 */
export async function searchUsers(
  term: string,
): Promise<
  | { ok: true; users: UserSearchResult[]; hasMore: boolean }
  | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/users/search/?q=${encodeURIComponent(term.trim())}`,
    );
    const body = (await response.json().catch(() => null)) as {
      data?: { results?: ApiUser[]; next?: string | null };
      message?: string;
    } | null;

    if (!response.ok) {
      return { ok: false, message: body?.message ?? "Search failed." };
    }

    const users = (body?.data?.results ?? [])
      .filter((user) => user.username)
      .map((user) => ({
        id: String(user.id),
        username: user.username as string,
        name: user.profile?.display_label || (user.username as string),
        avatarUrl: user.profile?.avatar_url || undefined,
      }));

    return { ok: true, users, hasMore: Boolean(body?.data?.next) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Network error. Please try again.",
    };
  }
}
