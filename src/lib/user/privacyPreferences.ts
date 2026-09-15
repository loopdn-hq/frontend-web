/**
 * The privacy settings.
 *
 * Saved on the account (`PrivacySettings`, through lib/user/accountSettings),
 * with a copy in this browser that the screen reads - AND NOTHING ENFORCES
 * THEM. Until the backend reads them, choosing
 * "Nobody" does not stop a direct message, and switching off either "Find me"
 * switch hides nobody: `find_user` (backend user/lookups.py) still resolves an
 * exact verified phone number or email when someone starts a direct message,
 * adds members or invites by email, and `GET /users/search/` also matches an
 * exact verified number. Enforcing them means gating `find_user`, not only
 * search. Shipping these to real people before the server reads them would
 * tell them they are hidden when they are not.
 *
 * Blocking is NOT here. It is real (lib/user/blocks) and already enforced.
 *
 * A new setting: add its row here, then its API name in
 * lib/user/accountSettings. The screen does not change.
 */
import {
  createLocalPreferences,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";

/**
 * Who a "who can" setting lets through. There is no contacts list in the
 * product yet, so the middle option is the one relationship that exists:
 * sharing a Loop.
 */
export const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "loops", label: "People in my Loops" },
  { value: "nobody", label: "Nobody" },
] as const;

export type Audience = (typeof AUDIENCES)[number]["value"];

export type LocalPrivacyPreferences = {
  directMessages: Audience;
  groupAdds: Audience;
  findByPhone: boolean;
  findByEmail: boolean;
  readReceipts: boolean;
  onlineStatus: boolean;
};

// As the design shows a new account: open to everyone, everything on.
export const defaultLocalPrivacyPreferences: LocalPrivacyPreferences = {
  directMessages: "everyone",
  groupAdds: "everyone",
  findByPhone: true,
  findByEmail: true,
  readReceipts: true,
  onlineStatus: true,
};

/**
 * Every row, grouped and in the order the Privacy screen shows them. Safety -
 * the blocked list - is added by the screen itself, because it is not a
 * setting kept here.
 */
export const PRIVACY_GROUPS: readonly PreferenceGroup<LocalPrivacyPreferences>[] =
  [
    {
      title: "Messaging & contact",
      rows: [
        {
          kind: "choice",
          key: "directMessages",
          label: "Who can send me direct messages",
          description:
            "Who can start a direct message with you. People you've blocked never can.",
          options: AUDIENCES,
        },
        {
          kind: "choice",
          key: "groupAdds",
          label: "Who can add me to groups",
          description:
            "Who can add you to a Loop. People you've blocked never can.",
          options: AUDIENCES,
        },
      ],
    },
    {
      title: "Discoverability",
      rows: [
        {
          kind: "switch",
          key: "findByPhone",
          label: "Find me using my phone number",
        },
        { kind: "switch", key: "findByEmail", label: "Find me using my email" },
      ],
    },
    {
      title: "Activity",
      rows: [
        { kind: "switch", key: "readReceipts", label: "Read receipts" },
        { kind: "switch", key: "onlineStatus", label: "Online status" },
      ],
    },
  ];

const store = createLocalPreferences({
  storageKey: "loopdn_privacy_prefs",
  defaults: defaultLocalPrivacyPreferences,
  groups: PRIVACY_GROUPS,
});

export const useLocalPrivacyPreferences = store.useValues;
export const saveLocalPrivacyPreferences = store.save;
