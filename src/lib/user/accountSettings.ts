"use client";

import { authorizedRequest } from "@/lib/chat/conversations";
import type { MessagingPreferences } from "./messagingPreferences";
import type { LocalNotificationPreferences } from "./notificationPreferences";
import type { LocalPrivacyPreferences } from "./privacyPreferences";

/**
 * The settings saved on the account: `GET /users/me/settings/` and
 * `PATCH /users/me/settings/<screen>/`.
 *
 * The web and the API name settings differently (`findByPhone` is
 * `discoverable_by_phone`), so each screen lists its fields ONCE below, web
 * name to API name, and nothing else in the app spells an API name. A key a
 * screen does not list is never sent.
 *
 * Saved is not enforced: nothing on the server reads Notifications or Privacy
 * yet. What each row does today is written in its screen's file in lib/user.
 */

/** Messaging's values as the account holds them - every row. */
export type AccountMessagingPreferences = MessagingPreferences;

type ScreenValues = {
  messaging: AccountMessagingPreferences;
  notifications: LocalNotificationPreferences;
  privacy: LocalPrivacyPreferences;
};

export type AccountSettingsScreen = keyof ScreenValues;

/** Web name → API field. Every key of a screen must be listed. */
const FIELDS: {
  [S in AccountSettingsScreen]: Record<keyof ScreenValues[S], string>;
} = {
  messaging: {
    enterToSend: "enter_to_send",
    linkPreviews: "link_previews_enabled",
    // "Send and receive Loop messages by text", for every Loop at once.
    smsDelivery: "sms_enabled",
    emailEnabled: "email_enabled",
  },
  notifications: {
    messages: "messages",
    groupMessages: "group_messages",
    directMessages: "direct_messages",
    mentionsAndReplies: "mentions_replies",
    groupInvitations: "group_invitations",
    incomingCalls: "incoming_calls",
    missedCalls: "missed_calls",
    smsDeliveryFailures: "sms_delivery_failures",
    emailDeliveryFailures: "email_delivery_failures",
    showPreview: "show_preview",
    sound: "sound",
  },
  privacy: {
    directMessages: "direct_messages_from",
    groupAdds: "group_adds_from",
    findByPhone: "discoverable_by_phone",
    findByEmail: "discoverable_by_email",
    readReceipts: "read_receipts_enabled",
    onlineStatus: "online_status_visible",
  },
};

type ApiValue = boolean | string;
type ApiScreen = Record<string, ApiValue>;

function toApi<S extends AccountSettingsScreen>(
  screen: S,
  change: Partial<ScreenValues[S]>,
): ApiScreen {
  const fields = FIELDS[screen] as Record<string, string>;
  const body: ApiScreen = {};
  for (const [key, value] of Object.entries(change)) {
    const field = fields[key];
    if (field && value !== undefined) {
      body[field] = value as ApiValue;
    }
  }
  return body;
}

function fromApi<S extends AccountSettingsScreen>(
  screen: S,
  data: ApiScreen | undefined,
): Partial<ScreenValues[S]> {
  const values: Record<string, ApiValue> = {};
  const fields = FIELDS[screen] as Record<string, string>;
  for (const [key, field] of Object.entries(fields)) {
    if (data && field in data) values[key] = data[field];
  }
  return values as Partial<ScreenValues[S]>;
}

export type AccountSettings = {
  [S in AccountSettingsScreen]: Partial<ScreenValues[S]>;
};

type Failure = { ok: false; message: string };

/** Every screen's saved values, in the web's names. */
export async function fetchAccountSettings(): Promise<
  { ok: true; settings: AccountSettings } | Failure
> {
  try {
    const response = await authorizedRequest("/users/me/settings/");
    const body = (await response.json().catch(() => null)) as {
      data?: Partial<Record<AccountSettingsScreen, ApiScreen>>;
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message: body?.message ?? "Could not load your settings.",
      };
    }

    const data = body?.data ?? {};
    return {
      ok: true,
      settings: {
        messaging: fromApi("messaging", data.messaging),
        notifications: fromApi("notifications", data.notifications),
        privacy: fromApi("privacy", data.privacy),
      },
    };
  } catch (error) {
    return { ok: false, message: reasonFor(error) };
  }
}

/**
 * Saves only the keys in `change`, and answers with the whole screen as the
 * server now holds it.
 */
export async function saveAccountSettings<S extends AccountSettingsScreen>(
  screen: S,
  change: Partial<ScreenValues[S]>,
): Promise<{ ok: true; values: Partial<ScreenValues[S]> } | Failure> {
  try {
    const response = await authorizedRequest(`/users/me/settings/${screen}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApi(screen, change)),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: ApiScreen;
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message: body?.message ?? "Couldn't save that. Try again.",
      };
    }
    return { ok: true, values: fromApi(screen, body?.data) };
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
