import { authorizedRequest } from "@/lib/chat/conversations";
import type {
  ConnectionStatus,
  ConnectionTemplates,
  ConsentStatus,
  EmbeddedSignupResult,
  GroupChannel,
  GroupWhatsAppState,
  InviteOutcome,
  InviteResult,
  WhatsAppConfig,
  WhatsAppConnection,
  WhatsAppFailure,
  WhatsAppReason,
  WhatsAppResult,
} from "@/lib/whatsapp/types";

/**
 * Every WhatsApp request the app makes, and the only place any of them is
 * written. Components call these; none of them calls fetch.
 *
 * Goes through `authorizedRequest`, the same bearer-token fetch with a single
 * refresh-and-retry that billing, push and the calls module use.
 *
 * Failures come back as data rather than exceptions, because the caller almost
 * always has to BRANCH on why: `whatsapp_not_connected` opens Embedded Signup
 * and retries, `choose_connection` asks a question first, `not_admin` hides a
 * control. A thrown error would flatten all of that into one catch.
 */

const BASE = "/whatsapp";

type ApiObject = Record<string, unknown>;

function isObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const REASONS: readonly WhatsAppReason[] = [
  "whatsapp_not_connected",
  "choose_connection",
  "no_verified_number",
  "not_admin",
  "not_owner",
  "keyword_taken",
  "not_attached",
  "waba_not_granted",
  "number_not_in_waba",
  "number_in_use",
  "suspended",
  "invalid",
];

function envelopeData(payload: unknown): unknown {
  return isObject(payload) ? payload.data : undefined;
}

/**
 * The failure half of a response.
 *
 * `message` is the envelope's own line (loopd/renderers.py already reduced the
 * server's error to one human sentence). `reason` is dug out of `data`, where
 * the exception handler puts it beside `detail`.
 */
function failure(
  payload: unknown,
  status: number,
  fallback: string,
): WhatsAppFailure {
  const data = envelopeData(payload);
  const raw = isObject(data) ? text(data.reason) : "";
  const reason = (REASONS as readonly string[]).includes(raw)
    ? (raw as WhatsAppReason)
    : null;

  return {
    ok: false,
    message: (isObject(payload) ? text(payload.message) : "") || fallback,
    reason,
    status,
    // 503 is Meta being unreachable or unconfigured - the request was fine.
    retryable: status === 503,
    rateLimited: status === 429,
  };
}

function networkFailure(error: unknown): WhatsAppFailure {
  return {
    ok: false,
    message:
      error instanceof Error && error.message
        ? error.message
        : "Network error. Please try again.",
    reason: null,
    status: null,
    retryable: true,
    rateLimited: false,
  };
}

/** Runs a request and reduces it to a result, so no caller writes this twice. */
async function request<T>(
  path: string,
  init: RequestInit,
  fallback: string,
  parse: (data: unknown, payload: unknown) => T | null,
): Promise<WhatsAppResult<T>> {
  try {
    const response = await authorizedRequest(`${BASE}${path}`, init);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) return failure(payload, response.status, fallback);

    const parsed = parse(envelopeData(payload), payload);
    if (parsed === null) {
      return failure(payload, response.status, fallback);
    }
    return { ok: true, data: parsed };
  } catch (error) {
    return networkFailure(error);
  }
}

const GET: RequestInit = { method: "GET" };
const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

// -- normalizers -----------------------------------------------------------

const STATUSES: readonly ConnectionStatus[] = ["active", "error", "suspended"];

function normalizeConnection(raw: unknown): WhatsAppConnection | null {
  if (!isObject(raw) || typeof raw.id !== "number") return null;

  const status = STATUSES.includes(raw.status as ConnectionStatus)
    ? (raw.status as ConnectionStatus)
    : "error";

  return {
    id: raw.id,
    status,
    wabaId: text(raw.waba_id),
    phoneNumberId: text(raw.phone_number_id),
    displayPhoneNumber: text(raw.display_phone_number),
    verifiedName: text(raw.verified_name),
    qualityRating: text(raw.quality_rating),
    messagingLimitTier: text(raw.messaging_limit_tier),
    notificationTemplateName: text(raw.notification_template_name),
    notificationTemplateLanguage: text(raw.notification_template_language),
    invitationTemplateName: text(raw.invitation_template_name),
    lastError: text(raw.last_error),
    connectedAt: nullableText(raw.connected_at),
    groups: Array.isArray(raw.groups)
      ? raw.groups.filter(isObject).map((group) => ({
          id: count(group.id),
          name: text(group.name),
          keyword: text(group.keyword),
        }))
      : [],
  };
}

function normalizeChannel(raw: unknown): GroupChannel | null {
  if (!isObject(raw)) return null;
  return {
    id: count(raw.id),
    keyword: text(raw.keyword),
    displayPhoneNumber: text(raw.display_phone_number),
    verifiedName: text(raw.verified_name),
    connectionStatus: STATUSES.includes(
      raw.connection_status as ConnectionStatus,
    )
      ? (raw.connection_status as ConnectionStatus)
      : "error",
    deliveryEnabled: raw.delivery_enabled !== false,
    repliesEnabled: raw.replies_enabled !== false,
    joinLink: text(raw.join_link),
  };
}

const CONSENTS: readonly ConsentStatus[] = [
  "pending",
  "opted_in",
  "declined",
  "opted_out",
];

function normalizeGroupState(raw: unknown): GroupWhatsAppState | null {
  if (!isObject(raw)) return null;
  const consent = text(raw.my_consent);
  return {
    connected: raw.connected === true,
    channel: normalizeChannel(raw.channel),
    isAdmin: raw.is_admin === true,
    myConsent: CONSENTS.includes(consent as ConsentStatus)
      ? (consent as ConsentStatus)
      : null,
    myNumberVerified: raw.my_number_verified === true,
  };
}

const OUTCOMES: readonly InviteOutcome[] = [
  "invited",
  "not_sent",
  "already_opted_in",
  "declined",
];

function normalizeInvite(raw: unknown): InviteResult | null {
  if (!isObject(raw)) return null;
  const outcome = text(raw.outcome);
  return {
    outcome: OUTCOMES.includes(outcome as InviteOutcome)
      ? (outcome as InviteOutcome)
      : "not_sent",
    participant: count(raw.participant),
    channel: normalizeChannel(raw.channel),
    deliveryStatus: nullableText(raw.delivery_status),
    reason: text(raw.reason),
  };
}

// -- config & connections --------------------------------------------------

/** GET config/. `enabled` false means hide every WhatsApp entry point. */
export function fetchWhatsAppConfig(): Promise<WhatsAppResult<WhatsAppConfig>> {
  return request(
    "/config/",
    GET,
    "Unable to load WhatsApp settings.",
    (data) =>
      isObject(data)
        ? {
            enabled: data.enabled === true,
            appId: text(data.app_id),
            configId: text(data.config_id),
            graphVersion: text(data.graph_version),
          }
        : null,
  );
}

/** GET connections/. Paginated; an empty list means "offer Connect". */
export function fetchConnections(): Promise<
  WhatsAppResult<WhatsAppConnection[]>
> {
  return request(
    "/connections/",
    GET,
    "Unable to load your WhatsApp numbers.",
    (data) => {
      const rows = Array.isArray(data)
        ? data
        : isObject(data) && Array.isArray(data.results)
          ? data.results
          : [];
      return rows
        .map(normalizeConnection)
        .filter((row): row is WhatsAppConnection => row !== null);
    },
  );
}

/**
 * POST connections/ - the last step of Embedded Signup.
 *
 * The code is single-use and expires in minutes: it is posted the moment both
 * halves arrive and never retried. A failure here means starting the flow
 * again, not sending this code a second time.
 */
export function createConnection(
  signup: EmbeddedSignupResult,
): Promise<WhatsAppResult<WhatsAppConnection>> {
  return request(
    "/connections/",
    jsonBody("POST", {
      code: signup.code,
      waba_id: signup.wabaId,
      phone_number_id: signup.phoneNumberId,
      ...(signup.businessId ? { business_id: signup.businessId } : {}),
    }),
    "Couldn't connect WhatsApp Business.",
    normalizeConnection,
  );
}

/** PATCH connections/{id}/ - the template names, the only editable fields. */
export function updateConnectionTemplates(
  connectionId: number,
  templates: Partial<ConnectionTemplates>,
): Promise<WhatsAppResult<WhatsAppConnection>> {
  const body: ApiObject = {};
  if (templates.notificationTemplateName !== undefined) {
    body.notification_template_name = templates.notificationTemplateName;
  }
  if (templates.notificationTemplateLanguage !== undefined) {
    body.notification_template_language =
      templates.notificationTemplateLanguage;
  }
  if (templates.invitationTemplateName !== undefined) {
    body.invitation_template_name = templates.invitationTemplateName;
  }

  return request(
    `/connections/${connectionId}/`,
    jsonBody("PATCH", body),
    "Couldn't save those template names.",
    normalizeConnection,
  );
}

/** POST connections/{id}/refresh/ - re-read name, quality and limits from Meta. */
export function refreshConnection(
  connectionId: number,
): Promise<WhatsAppResult<WhatsAppConnection>> {
  return request(
    `/connections/${connectionId}/refresh/`,
    { method: "POST" },
    "Couldn't refresh from WhatsApp.",
    normalizeConnection,
  );
}

/**
 * DELETE connections/{id}/ - detaches EVERY group using it, so the caller
 * confirms first and says how many.
 */
export function disconnectConnection(
  connectionId: number,
): Promise<WhatsAppResult<true>> {
  return request(
    `/connections/${connectionId}/`,
    { method: "DELETE" },
    "Couldn't disconnect that number.",
    () => true,
  );
}

// -- one group -------------------------------------------------------------

/** GET groups/{id}/ - the channel, and this member's own standing. */
export function fetchGroupWhatsApp(
  conversationId: string | number,
): Promise<WhatsAppResult<GroupWhatsAppState>> {
  return request(
    `/groups/${conversationId}/`,
    GET,
    "Unable to load WhatsApp for this group.",
    normalizeGroupState,
  );
}

/** PUT groups/{id}/ - attach a number to the group. Admins only. */
export function attachGroupWhatsApp(
  conversationId: string | number,
  options: {
    connection: number;
    keyword?: string;
    deliveryEnabled?: boolean;
    repliesEnabled?: boolean;
  },
): Promise<WhatsAppResult<GroupWhatsAppState>> {
  const body: ApiObject = { connection: options.connection };
  if (options.keyword !== undefined) body.keyword = options.keyword;
  if (options.deliveryEnabled !== undefined) {
    body.delivery_enabled = options.deliveryEnabled;
  }
  if (options.repliesEnabled !== undefined) {
    body.replies_enabled = options.repliesEnabled;
  }

  return request(
    `/groups/${conversationId}/`,
    jsonBody("PUT", body),
    "Couldn't put this group on WhatsApp.",
    normalizeGroupState,
  );
}

/** DELETE groups/{id}/ - take the group off WhatsApp. */
export function detachGroupWhatsApp(
  conversationId: string | number,
): Promise<WhatsAppResult<GroupWhatsAppState>> {
  return request(
    `/groups/${conversationId}/`,
    { method: "DELETE" },
    "Couldn't take this group off WhatsApp.",
    normalizeGroupState,
  );
}

/**
 * PUT groups/{id}/consent/ - the member's OWN opt-in.
 *
 * Nobody can send this for somebody else, which is why it is a separate route
 * from the invitation: Meta requires the opt-in to be the member's own act.
 */
export function setGroupWhatsAppConsent(
  conversationId: string | number,
  enabled: boolean,
): Promise<WhatsAppResult<GroupWhatsAppState>> {
  return request(
    `/groups/${conversationId}/consent/`,
    jsonBody("PUT", { enabled }),
    "Couldn't save your WhatsApp preference.",
    normalizeGroupState,
  );
}

/**
 * POST groups/{id}/invite/ - either a new number or somebody already in the
 * group, never both (the serializer refuses that outright).
 */
export function inviteByWhatsApp(
  conversationId: string | number,
  invite:
    | { phoneNumber: string; displayName: string; connection?: number }
    | { participant: number; connection?: number },
): Promise<WhatsAppResult<InviteResult>> {
  const body: ApiObject =
    "participant" in invite
      ? { participant: invite.participant }
      : { phone_number: invite.phoneNumber, display_name: invite.displayName };
  if (invite.connection !== undefined) body.connection = invite.connection;

  return request(
    `/groups/${conversationId}/invite/`,
    jsonBody("POST", body),
    "Couldn't send that WhatsApp invitation.",
    normalizeInvite,
  );
}
