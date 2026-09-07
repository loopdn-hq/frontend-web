import { isValidPhoneNumber } from "libphonenumber-js";
import { normalizePhone } from "@/lib/validation/auth";
import type { CreateConversationInvite } from "@/lib/chat/conversations";

/**
 * Turning what somebody typed into something the API accepts.
 *
 * One field takes three different kinds of person, so the shape of the input
 * is what decides which kind it is - there is no picker to get wrong:
 *
 *   @yul              a Loopd'n username
 *   yul@example.com   an email address
 *   +639171111111     a phone number
 *
 * The API splits them differently, which is why this cannot just pass an
 * array of strings through. `members` means "these accounts exist, fail the
 * whole request if one does not", so a typo is caught rather than silently
 * dropped. `invite` means "this person has no account, text them" and creates
 * a phone-only participant. Sending a phone number down the `members` path
 * would reject every invitee who has not signed up yet, which is most of them.
 */

export type MemberKind = "username" | "email" | "phone";

export type MemberEntry = {
  /** Exactly what was typed, so an error can quote it back. */
  raw: string;
  /** Normalised: no leading @, E.164 for phones, lowercased email. */
  value: string;
  kind: MemberKind;
};

export type MemberParseResult =
  | { ok: true; entry: MemberEntry }
  | { ok: false; raw: string; message: string };

// Django's own username charset, deliberately wider than signup's own rule:
// this decides what we are willing to SEND, and the server is what decides
// whether it resolves. Rejecting something the backend would have accepted is
// the worse error of the two, because `members` is all-or-nothing - one entry
// the client wrongly refuses is a group the user cannot create at all.
const USERNAME_PATTERN = /^[\w.@+-]{1,150}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Dialling, not naming: an explicit +, or something made only of the
// characters people punctuate numbers with and carrying enough digits to be
// one. A bare leading digit is NOT enough - `2fast` is a username.
const PHONE_SHAPED = /^[+(]?[\d\s().-]{6,}$/;
const MIN_PHONE_DIGITS = 7;

function looksLikePhone(value: string): boolean {
  if (value.startsWith("+")) return true;
  if (!PHONE_SHAPED.test(value)) return false;
  return value.replace(/\D/g, "").length >= MIN_PHONE_DIGITS;
}

/** Split a pasted or typed blob into candidate entries. */
export function splitMemberInput(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseMember(raw: string): MemberParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, raw, message: "Enter a username, email or phone number." };
  }

  // A leading @ is an explicit "this is a username", so it is checked before
  // the email test - otherwise @yul@example.com would be ambiguous.
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1);
    if (!USERNAME_PATTERN.test(username)) {
      return {
        ok: false,
        raw: trimmed,
        message: `"${trimmed}" is not a valid username.`,
      };
    }
    return { ok: true, entry: { raw: trimmed, value: username, kind: "username" } };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return {
      ok: true,
      entry: { raw: trimmed, value: trimmed.toLowerCase(), kind: "email" },
    };
  }

  if (looksLikePhone(trimmed)) {
    const normalized = normalizePhone(trimmed);
    if (!normalized || !isValidPhoneNumber(normalized)) {
      return {
        ok: false,
        raw: trimmed,
        message: `"${trimmed}" is not a valid phone number. Include the country code.`,
      };
    }
    return { ok: true, entry: { raw: trimmed, value: normalized, kind: "phone" } };
  }

  if (USERNAME_PATTERN.test(trimmed)) {
    return { ok: true, entry: { raw: trimmed, value: trimmed, kind: "username" } };
  }

  return {
    ok: false,
    raw: trimmed,
    message: `"${trimmed}" is not a username, email or phone number.`,
  };
}

/** True when the entry is already in the list. Phones/emails are compared normalised. */
export function isDuplicateMember(
  entries: MemberEntry[],
  candidate: MemberEntry,
): boolean {
  return entries.some(
    (entry) =>
      entry.kind === candidate.kind &&
      entry.value.toLowerCase() === candidate.value.toLowerCase(),
  );
}

export type MemberPayloadParts = {
  members: string[];
  invite: CreateConversationInvite[];
  inviteEmail: string[];
};

/**
 * A number safe to show the rest of the group: +63\u20261111.
 *
 * Mirrors `mask_number` in chat/models.py, and for the reason given there: a
 * phone participant's label goes out in the body of every message the group
 * sends, to everybody in it. Sending the number as the display name would
 * hand each invitee's number to every other member - the exact thing a
 * per-group number exists to prevent.
 */
export function maskPhone(e164: string): string {
  return e164.length < 6 ? e164 : `${e164.slice(0, 3)}\u2026${e164.slice(-4)}`;
}

/**
 * Split entries into the three fields the create-group endpoint takes.
 *
 * Usernames go to `members`, which resolves them against existing accounts and
 * fails the whole request on a miss - that is what makes a mistyped username an
 * error rather than a silently missing person.
 *
 * Phone numbers go to `invite` and addresses go to `invite_email`. Neither is
 * all-or-nothing, because not matching an account is the normal case for both:
 * the person is texted or emailed instead.
 *
 * `display_name` is required by the API and constrained non-empty on the
 * model, so a MASKED number stands in until an admin renames them.
 */
export function toMemberPayload(entries: MemberEntry[]): MemberPayloadParts {
  const members: string[] = [];
  const invite: CreateConversationInvite[] = [];
  const inviteEmail: string[] = [];

  for (const entry of entries) {
    if (entry.kind === "phone") {
      invite.push({
        phone_number: entry.value,
        display_name: maskPhone(entry.value),
      });
    } else if (entry.kind === "email") {
      inviteEmail.push(entry.value);
    } else {
      members.push(entry.value);
    }
  }

  return { members, invite, inviteEmail };
}
