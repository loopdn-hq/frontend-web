/**
 * The notification settings.
 *
 * Saved on the account (`NotificationSettings`, through
 * lib/user/accountSettings), with a copy in this browser (see
 * lib/app/localPreferences) that the screen reads. READ BY NOTHING that
 * decides what is delivered - there are no push notifications, calls or
 * delivery-failure alerts to switch off yet.
 *
 * A new setting: add its row here, then its API name in
 * lib/user/accountSettings. The screen does not change.
 *
 * Group email is NOT here. It is real (`MessagingSettings.email_enabled`) and lives on
 * the Messaging screen, where the design puts it.
 */
import {
  createLocalPreferences,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";

/** Only the default and silence until there are sound files to choose from. */
export const NOTIFICATION_SOUNDS = [
  { value: "default", label: "Loopd'n default" },
  { value: "none", label: "None" },
] as const;

export type NotificationSound = (typeof NOTIFICATION_SOUNDS)[number]["value"];

export type LocalNotificationPreferences = {
  messages: boolean;
  groupMessages: boolean;
  directMessages: boolean;
  mentionsAndReplies: boolean;
  groupInvitations: boolean;
  incomingCalls: boolean;
  missedCalls: boolean;
  smsDeliveryFailures: boolean;
  emailDeliveryFailures: boolean;
  showPreview: boolean;
  sound: NotificationSound;
};

// Everything on, as the design shows a new account.
export const defaultLocalNotificationPreferences: LocalNotificationPreferences =
  {
    messages: true,
    groupMessages: true,
    directMessages: true,
    mentionsAndReplies: true,
    groupInvitations: true,
    incomingCalls: true,
    missedCalls: true,
    smsDeliveryFailures: true,
    emailDeliveryFailures: true,
    showPreview: true,
    sound: "default",
  };

/** Every row, grouped and in the order the Notifications screen shows them. */
export const NOTIFICATION_GROUPS: readonly PreferenceGroup<LocalNotificationPreferences>[] =
  [
    {
      title: null,
      rows: [
        { kind: "switch", key: "messages", label: "Messages" },
        { kind: "switch", key: "groupMessages", label: "Group messages" },
        { kind: "switch", key: "directMessages", label: "Direct messages" },
        {
          kind: "switch",
          key: "mentionsAndReplies",
          label: "Mentions & replies",
        },
        { kind: "switch", key: "groupInvitations", label: "Group invitations" },
      ],
    },
    {
      title: "Calls",
      rows: [
        { kind: "switch", key: "incomingCalls", label: "Incoming calls" },
        { kind: "switch", key: "missedCalls", label: "Missed calls" },
      ],
    },
    {
      title: "External delivery",
      rows: [
        {
          kind: "switch",
          key: "smsDeliveryFailures",
          label: "SMS delivery failures",
        },
        {
          kind: "switch",
          key: "emailDeliveryFailures",
          label: "Email delivery failures",
        },
      ],
    },
    {
      title: "Notification preview",
      rows: [
        {
          kind: "switch",
          key: "showPreview",
          label: "Show sender and message",
        },
      ],
    },
    {
      title: null,
      rows: [
        {
          kind: "choice",
          key: "sound",
          label: "Sound",
          description: "What you hear when a notification arrives.",
          options: NOTIFICATION_SOUNDS,
        },
      ],
    },
  ];

const store = createLocalPreferences({
  storageKey: "loopdn_notification_prefs",
  defaults: defaultLocalNotificationPreferences,
  groups: NOTIFICATION_GROUPS,
});

export const useLocalNotificationPreferences = store.useValues;
export const saveLocalNotificationPreferences = store.save;
