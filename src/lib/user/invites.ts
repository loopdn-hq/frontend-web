"use client";

import { authorizedRequest } from "@/lib/chat/conversations";

/**
 * Inviting somebody who has no account - POST /users/invite/.
 *
 * EMAIL ONLY. Loopd'n cannot text an invitation: every number it owns belongs
 * to one Loop, so a stranger's phone has nothing to receive a link from (the
 * backend says the same, in user/invites.py). A typed phone number gets a link
 * to send by hand instead - see NewConversationModal.
 *
 * "Sent" is ALSO the answer for an address whose owner hid it in Settings →
 * Privacy, or who is on either side of a block, and nothing is emailed in
 * either case. That is deliberate: any other answer would turn this into a way
 * to ask whether an address has an account. So this never promises delivery,
 * and the words on the screen must not either.
 */
export type InviteResult =
  { ok: true; alreadyHere: boolean } | { ok: false; message: string };

export async function inviteToApp(email: string): Promise<InviteResult> {
  try {
    const response = await authorizedRequest("/users/invite/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const body = (await response.json().catch(() => null)) as {
      data?: { outcome?: string };
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message: body?.message ?? "Couldn't send that invitation. Try again.",
      };
    }

    // The one thing the server does say plainly: this address belongs to
    // somebody the inviter can already see, so there is nobody to invite.
    return { ok: true, alreadyHere: body?.data?.outcome === "already_here" };
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
