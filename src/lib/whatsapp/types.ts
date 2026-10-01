/**
 * The WhatsApp API's payloads, as the backend sends them.
 *
 * Shapes follow whatsapp/serializers.py and whatsapp/views.py. The access
 * token never appears in any of them, in either direction: it goes from Meta
 * to the database and from the database to Meta, and nowhere near a browser.
 */

export type WhatsAppConfig = {
  /** False when Meta is not configured for this deployment: hide every entry point. */
  enabled: boolean;
  /** Public by design - it is in the page that calls FB.login. */
  appId: string;
  configId: string;
  graphVersion: string;
};

export type ConnectionStatus = "active" | "error" | "suspended";

/** A group already using a connected number, for the "in use by" list. */
export type ConnectionGroup = {
  id: number;
  name: string;
  keyword: string;
};

export type WhatsAppConnection = {
  id: number;
  status: ConnectionStatus;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  messagingLimitTier: string;
  notificationTemplateName: string;
  notificationTemplateLanguage: string;
  invitationTemplateName: string;
  /** Why Meta last refused. Worth showing when `status` is "error". */
  lastError: string;
  connectedAt: string | null;
  groups: ConnectionGroup[];
};

/** The three template names, the only fields PATCH accepts. */
export type ConnectionTemplates = {
  notificationTemplateName: string;
  notificationTemplateLanguage: string;
  invitationTemplateName: string;
};

export type GroupChannel = {
  id: number;
  keyword: string;
  displayPhoneNumber: string;
  verifiedName: string;
  connectionStatus: ConnectionStatus;
  deliveryEnabled: boolean;
  repliesEnabled: boolean;
  /** wa.me link pre-filled with START: one-tap opt-in from the handset. */
  joinLink: string;
};

/**
 * A member's own answer about this group on WhatsApp.
 *
 * Null means never asked. "declined"/"opted_out" are theirs to undo - the
 * difference is only where they said no (the app, or STOP on the handset).
 */
export type ConsentStatus = "pending" | "opted_in" | "declined" | "opted_out";

export type GroupWhatsAppState = {
  connected: boolean;
  channel: GroupChannel | null;
  isAdmin: boolean;
  myConsent: ConsentStatus | null;
  /** Opting in cannot reach them without this; send them to verification first. */
  myNumberVerified: boolean;
};

export type InviteOutcome =
  "invited" | "not_sent" | "already_opted_in" | "declined";

export type InviteResult = {
  outcome: InviteOutcome;
  participant: number;
  channel: GroupChannel | null;
  deliveryStatus: string | null;
  /** Why it was not sent - e.g. no invitation template configured. */
  reason: string;
};

/**
 * The stable, machine-readable half of a 400.
 *
 * BRANCH ON THIS, never on the message text: the message is written for a
 * person and may be reworded at any time, while these are a contract
 * (whatsapp/errors.py, ConnectionRefused.code).
 */
export type WhatsAppReason =
  // The owner has no connected number yet: run Embedded Signup, then retry.
  | "whatsapp_not_connected"
  // Several numbers could serve this: ask which, then retry with `connection`.
  | "choose_connection"
  // Opting in cannot reach them: send them to phone verification.
  | "no_verified_number"
  | "not_admin"
  | "not_owner"
  | "keyword_taken"
  | "not_attached"
  // The Embedded Signup itself failed; each is worth showing as-is.
  | "waba_not_granted"
  | "number_not_in_waba"
  | "number_in_use"
  | "suspended"
  | "invalid";

export type WhatsAppFailure = {
  ok: false;
  /** The server's own line, already written for the person reading it. */
  message: string;
  reason: WhatsAppReason | null;
  status: number | null;
  /** True for a 503: Meta is unreachable or unconfigured, so retrying is fair. */
  retryable: boolean;
  /** True for a 429. The connect and invite endpoints are rate limited. */
  rateLimited: boolean;
};

export type WhatsAppResult<T> = { ok: true; data: T } | WhatsAppFailure;

/** What Embedded Signup hands back, once both halves have arrived. */
export type EmbeddedSignupResult = {
  /** Single-use and short-lived. Never logged, never stored, never retried. */
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
};
