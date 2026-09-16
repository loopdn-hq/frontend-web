/**
 * The messaging settings.
 *
 * Saved on the account (`MessagingSettings`, through lib/user/accountSettings),
 * with a copy in this browser that the screen and the chat box read. What each
 * row DOES is another matter - read this before relying on any row:
 *
 * - "Send and receive Loop messages by email" is REAL, and it is the ONE email
 *   row: `MessagingSettings.email_enabled`, for every Loop at once, and the
 *   shell keeps it on the profile rather than here. Unticked, no Loop emails
 *   you and your email replies are ignored (backend mail/outbound.py and
 *   mail/inbound.py). It is not STOP EMAILS: that reply, or the link at the
 *   bottom of a Loop's email, stops only that Loop, in both directions.
 * - "Press Enter to send" is real: the chat composer
 *   (components/home/HomeShell) reads the browser copy.
 * - "Show link previews" is real, and it is the SENDER's: with it on, the
 *   first link in a message you send gets a card the server fetches after
 *   sending (backend chat/link_previews.py), which everyone in the chat sees.
 * - "Send and receive Loop messages by text" is REAL, and it is the ONE SMS
 *   row: `MessagingSettings.sms_enabled`, for every Loop at once. Unticked, no
 *   Loop texts you and texts you send to a Loop are ignored (backend
 *   sms/outbound.py and sms/inbound.py). It is not STOP: replying STOP to a
 *   Loop's number stops only that Loop, and START undoes it there.
 *
 * A new setting: add its row here, then its API name in
 * lib/user/accountSettings. The screen does not change.
 */
import {
  createLocalPreferences,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";

export type LocalMessagingPreferences = {
  enterToSend: boolean;
  linkPreviews: boolean;
  /** "Send and receive Loop messages by text" - every Loop at once. */
  smsDelivery: boolean;
};

/** Everything the Messaging screen shows: the browser-kept values, and email. */
export type MessagingPreferences = LocalMessagingPreferences & {
  /** "Send and receive Loop messages by email" - every Loop at once. */
  emailEnabled: boolean;
};

// As the design shows a new account.
export const defaultLocalMessagingPreferences: LocalMessagingPreferences = {
  enterToSend: true,
  linkPreviews: true,
  // What the account starts with.
  smsDelivery: true,
};

export const defaultMessagingPreferences: MessagingPreferences = {
  ...defaultLocalMessagingPreferences,
  // The backend default: every account starts opted in.
  emailEnabled: true,
};

/** Every row, grouped and in the order the Messaging screen shows them. */
export const MESSAGING_GROUPS: readonly PreferenceGroup<MessagingPreferences>[] =
  [
    {
      title: "Sending messages",
      rows: [
        {
          kind: "checkbox",
          key: "enterToSend",
          label: "Press Enter to send",
          description:
            "When this is off, press Ctrl+Enter (⌘+Enter on a Mac) to send.",
        },
        { kind: "checkbox", key: "linkPreviews", label: "Show link previews" },
      ],
    },
    {
      title: "SMS",
      rows: [
        {
          kind: "checkbox",
          key: "smsDelivery",
          label: "Send and receive Loop messages by text",
          description:
            "Get texts from your Loops, and text back into them. Untick to use the app only. To stop just one Loop, reply STOP to its number.",
        },
      ],
    },
    {
      title: "Email",
      rows: [
        {
          kind: "checkbox",
          key: "emailEnabled",
          label: "Send and receive Loop messages by email",
          description:
            "Get email from your Loops, and reply to them by email. Untick to use the app only. To stop just one Loop, reply STOP EMAILS or use the link at the bottom of its emails.",
        },
      ],
    },
  ];

const store = createLocalPreferences({
  storageKey: "loopdn_messaging_prefs",
  defaults: defaultLocalMessagingPreferences,
  groups: MESSAGING_GROUPS,
});

export const useLocalMessagingPreferences = store.useValues;
export const saveLocalMessagingPreferences = store.save;
