/**
 * The messaging settings.
 *
 * Saved on the account (`MessagingSettings`, through lib/user/accountSettings),
 * with a copy in this browser that the screen and the chat box read. What each
 * row DOES is another matter - read this before relying on any row:
 *
 * - "Allow messages to be delivered by email" is REAL. It is
 *   `MessagingSettings.email_enabled`, the account-wide switch for group
 *   email, and the shell keeps it on the profile rather than here. It does not
 *   undo a single Loop stopped from an email's footer link: that is a per-Loop
 *   setting with no control in the app yet.
 * - "Press Enter to send" is real: the chat composer
 *   (components/home/HomeShell) reads the browser copy.
 * - Link previews, the external-contact choice, media auto-download and "Send
 *   SMS when recipient is available on Loopd'n" are saved and read by nothing
 *   yet. That last one starts ticked because the backend ALREADY texts every
 *   account member with a verified number in a Loop whose texts are on,
 *   whether or not they use the app (sms/outbound.py); unticking it changes
 *   no delivery.
 * - "Allow messages to be delivered by SMS" is NOT saved on the account and
 *   changes nothing - never trust it when debugging a text.
 *   `MessagingSettings.sms_enabled` is deliberately not writable from the app,
 *   and only a carrier STOP or START moves it (see its comment in the
 *   backend's user/models/messaging_settings.py). It stays in this browser.
 *
 * A new setting: add its row here, then its API name in
 * lib/user/accountSettings. The screen does not change.
 */
import {
  createLocalPreferences,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";

export const EXTERNAL_CONTACT_OPTIONS = [
  { value: "ask", label: "Ask me every time" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
] as const;

export const MEDIA_AUTO_DOWNLOAD_OPTIONS = [
  { value: "always", label: "Wi-Fi and mobile data" },
  { value: "wifi", label: "Wi-Fi only" },
  { value: "never", label: "Never" },
] as const;

export type LocalMessagingPreferences = {
  enterToSend: boolean;
  linkPreviews: boolean;
  externalContact: (typeof EXTERNAL_CONTACT_OPTIONS)[number]["value"];
  smsDelivery: boolean;
  smsWhenOnLoopdn: boolean;
  mediaAutoDownload: (typeof MEDIA_AUTO_DOWNLOAD_OPTIONS)[number]["value"];
};

/** Everything the Messaging screen shows: the browser-kept values, and email. */
export type MessagingPreferences = LocalMessagingPreferences & {
  /** Group email across every Loop - `MessagingSettings.email_enabled`. */
  emailEnabled: boolean;
};

// As the design shows a new account. "Ask me every time" because nothing has
// been chosen yet, and asking is the only default that decides nothing.
export const defaultLocalMessagingPreferences: LocalMessagingPreferences = {
  enterToSend: true,
  linkPreviews: true,
  externalContact: "ask",
  smsDelivery: true,
  // What the account starts with, and what delivery already does - see above.
  smsWhenOnLoopdn: true,
  mediaAutoDownload: "wifi",
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
      title: "External messaging",
      rows: [
        {
          kind: "radio",
          key: "externalContact",
          label: "Default way to contact people without Loopd'n",
          options: EXTERNAL_CONTACT_OPTIONS,
        },
      ],
    },
    {
      title: "SMS",
      rows: [
        {
          kind: "checkbox",
          key: "smsDelivery",
          label: "Allow messages to be delivered by SMS",
          // True of the backend today (sms/inbound.py): a STOP moves the switch
          // for every group that number is in, and a START fully restores only
          // when it goes to the number that got the STOP. In the description,
          // not a note under the card, so the checkbox is described by it.
          description:
            "Texts are controlled from your phone for now: reply STOP to any Loop's number and texts stop from every Loop; reply START to that same number to turn them back on.",
        },
        {
          kind: "checkbox",
          key: "smsWhenOnLoopdn",
          label: "Send SMS when recipient is available on Loopd'n",
        },
      ],
    },
    {
      title: "Email",
      rows: [
        {
          kind: "checkbox",
          key: "emailEnabled",
          label: "Allow messages to be delivered by email",
          description:
            "Stops or allows email from every Loop at once. It doesn't restart a Loop you stopped with the link at the bottom of its emails - there's no switch for a single Loop in the app yet.",
        },
      ],
    },
    {
      title: "Media",
      rows: [
        {
          kind: "select",
          key: "mediaAutoDownload",
          label: "Photo & video auto-download",
          options: MEDIA_AUTO_DOWNLOAD_OPTIONS,
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
