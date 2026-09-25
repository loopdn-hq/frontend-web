import { authorizedRequest } from "@/lib/chat/conversations";

/**
 * The calls API, and nothing else.
 *
 * Django decides everything about a call - who may be in it, how many, what
 * they may publish - and hands this browser a short-lived LiveKit token for
 * the one room it may join. That token is the only credential that ever
 * reaches the client; the LiveKit API secret stays on the server.
 *
 * Shapes follow calls/serializers.py. The socket's `call.*` frames carry the
 * SAME serialized call as these responses, which is why `normalizeCall` is
 * exported: one reader for both.
 */

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended";
export type CallEndReason =
  "" | "ended" | "empty" | "declined" | "unanswered" | "timed_out";

export type CallUser = {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
};

/**
 * One person's time in one call. Somebody who drops and comes back has two,
 * so "who is in it now" is the stays whose `leftAt` is null.
 */
export type CallStay = {
  id: string;
  user: CallUser;
  joinedAt: string;
  leftAt: string | null;
  /** Seconds. Null while the stay is open. */
  duration: number | null;
};

export type Call = {
  id: number;
  conversationId: number;
  type: CallType;
  status: CallStatus;
  endReason: CallEndReason;
  createdBy: CallUser | null;
  /** When the second person joined. Null for a call nobody answered. */
  startedAt: string | null;
  endedAt: string | null;
  /** When it started ringing. */
  createdAt: string;
  participantCount: number;
  isRecording: boolean;
  participants: CallStay[];
};

/** What the browser needs to connect to LiveKit. Only ever handed to its owner. */
export type CallConnection = {
  url: string;
  token: string;
  expiresAt: string;
};

export type RecordingStatus =
  "starting" | "recording" | "stopping" | "completed" | "failed" | "deleted";

export type CallRecording = {
  id: number;
  callId: number;
  status: RecordingStatus;
  startedBy: CallUser | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  contentType: string;
  expiresAt: string | null;
  deletedAt: string | null;
  /** Signed, short-lived. Only on GET /recordings/<id>/, and only once completed. */
  downloadUrl: string | null;
};

export type CallFailure = {
  ok: false;
  message: string;
  /** The HTTP status, so a caller can tell "full" (403) from "ended" (409). */
  status?: number;
};

type ApiObject = Record<string, unknown>;

function isApiObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function envelopeData(payload: unknown): unknown {
  return isApiObject(payload) ? payload.data : undefined;
}

/**
 * The envelope's `message` is already the one human line the server chose
 * (loopd/renderers.py), including for `{detail, call_id}` conflicts.
 */
function failure(
  payload: unknown,
  status: number | undefined,
  fallback: string,
): CallFailure {
  const message = isApiObject(payload) ? text(payload.message) : "";
  return { ok: false, message: message || fallback, status };
}

function networkFailure(error: unknown): CallFailure {
  return {
    ok: false,
    message:
      error instanceof Error && error.message
        ? error.message
        : "Network error. Please try again.",
  };
}

function normalizeUser(raw: unknown): CallUser | null {
  if (!isApiObject(raw) || raw.id === undefined || raw.id === null) {
    return null;
  }
  const profile = isApiObject(raw.profile) ? raw.profile : {};
  const username = text(raw.username);
  return {
    id: String(raw.id),
    username,
    name: text(profile.display_label) || username || "Someone",
    avatarUrl: nullableText(profile.avatar_url) ?? undefined,
  };
}

function normalizeStay(raw: unknown): CallStay | null {
  if (!isApiObject(raw)) return null;
  const user = normalizeUser(raw.user);
  if (!user) return null;
  return {
    id: String(raw.id),
    user,
    joinedAt: text(raw.joined_at),
    leftAt: nullableText(raw.left_at),
    duration: nullableNumber(raw.duration),
  };
}

const END_REASONS: readonly CallEndReason[] = [
  "",
  "ended",
  "empty",
  "declined",
  "unanswered",
  "timed_out",
];

export function normalizeCall(raw: unknown): Call | null {
  if (!isApiObject(raw) || typeof raw.id !== "number") return null;

  const status: CallStatus =
    raw.status === "active" || raw.status === "ended" ? raw.status : "ringing";
  const endReason = END_REASONS.includes(raw.end_reason as CallEndReason)
    ? (raw.end_reason as CallEndReason)
    : "";

  return {
    id: raw.id,
    conversationId: Number(raw.conversation),
    type: raw.call_type === "video" ? "video" : "audio",
    status,
    endReason,
    createdBy: normalizeUser(raw.created_by),
    startedAt: nullableText(raw.started_at),
    endedAt: nullableText(raw.ended_at),
    createdAt: text(raw.created_at),
    participantCount: nullableNumber(raw.participant_count) ?? 0,
    isRecording: raw.is_recording === true,
    participants: Array.isArray(raw.participants)
      ? raw.participants
          .map(normalizeStay)
          .filter((stay): stay is CallStay => stay !== null)
      : [],
  };
}

function normalizeConnection(raw: unknown): CallConnection | null {
  if (!isApiObject(raw)) return null;
  const url = text(raw.url);
  const token = text(raw.token);
  if (!url || !token) return null;
  return { url, token, expiresAt: text(raw.expires_at) };
}

const RECORDING_STATUSES: readonly RecordingStatus[] = [
  "starting",
  "recording",
  "stopping",
  "completed",
  "failed",
  "deleted",
];

function normalizeRecording(raw: unknown): CallRecording | null {
  if (!isApiObject(raw) || typeof raw.id !== "number") return null;
  return {
    id: raw.id,
    callId: Number(raw.call),
    status: RECORDING_STATUSES.includes(raw.status as RecordingStatus)
      ? (raw.status as RecordingStatus)
      : "failed",
    startedBy: normalizeUser(raw.started_by),
    startedAt: text(raw.started_at),
    endedAt: nullableText(raw.ended_at),
    durationSeconds: nullableNumber(raw.duration_seconds),
    sizeBytes: nullableNumber(raw.size_bytes),
    contentType: text(raw.content_type),
    expiresAt: nullableText(raw.expires_at),
    deletedAt: nullableText(raw.deleted_at),
    downloadUrl: nullableText(raw.download_url),
  };
}

/** Who is in the call right now, as opposed to everybody who ever was. */
export function currentStays(call: Call): CallStay[] {
  return call.participants.filter((stay) => stay.leftAt === null);
}

export function isCallLive(call: Call): boolean {
  return call.status !== "ended";
}

// -- requests ------------------------------------------------------------

type CallAndConnection =
  { ok: true; call: Call; connection: CallConnection } | CallFailure;

/** The `{call, livekit}` answer of start and join. */
async function readCallAndConnection(
  response: Response,
  fallback: string,
): Promise<CallAndConnection> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return failure(payload, response.status, fallback);

  const data = envelopeData(payload);
  const call = isApiObject(data) ? normalizeCall(data.call) : null;
  const connection = isApiObject(data)
    ? normalizeConnection(data.livekit)
    : null;
  if (!call || !connection) {
    return { ok: false, message: fallback, status: response.status };
  }
  return { ok: true, call, connection };
}

/** The `{call}` answer of leave, reject and end. */
async function readCall(
  response: Response,
  fallback: string,
): Promise<{ ok: true; call: Call } | CallFailure> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return failure(payload, response.status, fallback);

  const data = envelopeData(payload);
  // Leave/reject/end wrap it in {call}; retrieve answers with the call itself.
  const call = normalizeCall(
    isApiObject(data) && "call" in data ? data.call : data,
  );
  if (!call) return { ok: false, message: fallback, status: response.status };
  return { ok: true, call };
}

const JSON_POST: RequestInit = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
};

/**
 * POST /calls/ - start a call and join it.
 *
 * A conversation has at most one live call. Pressing Call while one is going
 * is a 409 carrying its id, surfaced as `existingCallId` so the caller can
 * join that one instead of showing an error.
 */
export async function startCall(
  conversationId: string | number,
  type: CallType,
): Promise<CallAndConnection | (CallFailure & { existingCallId?: number })> {
  try {
    const response = await authorizedRequest("/calls/", {
      ...JSON_POST,
      body: JSON.stringify({
        conversation: Number(conversationId),
        call_type: type,
      }),
    });

    if (response.status === 409) {
      const payload: unknown = await response.json().catch(() => null);
      const data = envelopeData(payload);
      const existingCallId =
        isApiObject(data) && typeof data.call_id === "number"
          ? data.call_id
          : undefined;
      return {
        ...failure(payload, 409, "There is already a call in progress here."),
        existingCallId,
      };
    }

    return readCallAndConnection(response, "Unable to start the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/**
 * POST /calls/<id>/join/ - join, or take a fresh token for a call already in.
 *
 * Idempotent on the server, which is what a reconnect relies on: the old
 * token is spent the moment LiveKit accepts it, so a rejoin needs a new one.
 */
export async function joinCall(callId: number): Promise<CallAndConnection> {
  try {
    const response = await authorizedRequest(
      `/calls/${callId}/join/`,
      JSON_POST,
    );
    return readCallAndConnection(response, "Unable to join the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/**
 * POST /calls/<id>/leave/. The last one out ends the call.
 *
 * `keepalive` is for a page being closed: it lets the request outlive the
 * document that sent it. LiveKit's webhook would catch the departure anyway,
 * but only once the connection times out.
 */
export async function leaveCall(
  callId: number,
  { keepalive = false }: { keepalive?: boolean } = {},
): Promise<{ ok: true; call: Call } | CallFailure> {
  try {
    const response = await authorizedRequest(`/calls/${callId}/leave/`, {
      ...JSON_POST,
      keepalive,
    });
    return readCall(response, "Unable to leave the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/** POST /calls/<id>/reject/. In a group only says "not me"; a one-to-one ends. */
export async function rejectCall(
  callId: number,
): Promise<{ ok: true; call: Call } | CallFailure> {
  try {
    const response = await authorizedRequest(
      `/calls/${callId}/reject/`,
      JSON_POST,
    );
    return readCall(response, "Unable to decline the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/** POST /calls/<id>/end/ - for everyone. The starter or a group admin only. */
export async function endCall(
  callId: number,
): Promise<{ ok: true; call: Call } | CallFailure> {
  try {
    const response = await authorizedRequest(
      `/calls/${callId}/end/`,
      JSON_POST,
    );
    return readCall(response, "Unable to end the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/** GET /calls/<id>/ */
export async function fetchCall(
  callId: number,
): Promise<{ ok: true; call: Call } | CallFailure> {
  try {
    const response = await authorizedRequest(`/calls/${callId}/`);
    return readCall(response, "Unable to load the call.");
  } catch (error) {
    return networkFailure(error);
  }
}

/**
 * GET /calls/ - every call this account can see, newest first, twenty a page.
 * Optionally narrowed to one conversation and/or one status.
 */
export async function fetchCalls(
  options: {
    page?: number;
    conversationId?: string | number;
    status?: CallStatus;
  } = {},
): Promise<{ ok: true; calls: Call[]; hasMore: boolean } | CallFailure> {
  const params = new URLSearchParams();
  if (options.page && options.page > 1)
    params.set("page", String(options.page));
  if (options.conversationId !== undefined) {
    params.set("conversation", String(options.conversationId));
  }
  if (options.status) params.set("status", options.status);
  const query = params.toString();

  try {
    const response = await authorizedRequest(
      `/calls/${query ? `?${query}` : ""}`,
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return failure(payload, response.status, "Unable to load your calls.");
    }

    const data = envelopeData(payload);
    const rows = Array.isArray(data)
      ? data
      : isApiObject(data) && Array.isArray(data.results)
        ? data.results
        : [];
    return {
      ok: true,
      calls: rows
        .map(normalizeCall)
        .filter((call): call is Call => call !== null),
      hasMore: isApiObject(data) && Boolean(data.next),
    };
  } catch (error) {
    return networkFailure(error);
  }
}

// -- recordings ------------------------------------------------------------

async function readRecording(
  response: Response,
  fallback: string,
): Promise<{ ok: true; recording: CallRecording } | CallFailure> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return failure(payload, response.status, fallback);
  const recording = normalizeRecording(envelopeData(payload));
  if (!recording) {
    return { ok: false, message: fallback, status: response.status };
  }
  return { ok: true, recording };
}

/** POST /calls/<id>/recording/start/. Plan-gated; the refusal says so. */
export async function startRecording(
  callId: number,
): Promise<{ ok: true; recording: CallRecording } | CallFailure> {
  try {
    const response = await authorizedRequest(
      `/calls/${callId}/recording/start/`,
      JSON_POST,
    );
    return readRecording(response, "Unable to start recording.");
  } catch (error) {
    return networkFailure(error);
  }
}

/** POST /calls/<id>/recording/stop/. The file is finalised in the background. */
export async function stopRecording(
  callId: number,
): Promise<{ ok: true; recording: CallRecording } | CallFailure> {
  try {
    const response = await authorizedRequest(
      `/calls/${callId}/recording/stop/`,
      JSON_POST,
    );
    return readRecording(response, "Unable to stop recording.");
  } catch (error) {
    return networkFailure(error);
  }
}

/**
 * GET /calls/<id>/recordings/. A 404 for somebody who was never on the call
 * and does not administer it - the server will not confirm there is anything.
 */
export async function fetchCallRecordings(
  callId: number,
): Promise<{ ok: true; recordings: CallRecording[] } | CallFailure> {
  try {
    const response = await authorizedRequest(`/calls/${callId}/recordings/`);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return failure(payload, response.status, "Unable to load recordings.");
    }
    const data = envelopeData(payload);
    const rows = Array.isArray(data)
      ? data
      : isApiObject(data) && Array.isArray(data.results)
        ? data.results
        : [];
    return {
      ok: true,
      recordings: rows
        .map(normalizeRecording)
        .filter((row): row is CallRecording => row !== null),
    };
  } catch (error) {
    return networkFailure(error);
  }
}

/** GET /recordings/<id>/ - metadata, plus a freshly signed download link. */
export async function fetchRecording(
  recordingId: number,
): Promise<{ ok: true; recording: CallRecording } | CallFailure> {
  try {
    const response = await authorizedRequest(`/recordings/${recordingId}/`);
    return readRecording(response, "Unable to load the recording.");
  } catch (error) {
    return networkFailure(error);
  }
}

/** DELETE /recordings/<id>/ - the file goes, the record of it stays. */
export async function deleteRecording(
  recordingId: number,
): Promise<{ ok: true } | CallFailure> {
  try {
    const response = await authorizedRequest(`/recordings/${recordingId}/`, {
      method: "DELETE",
    });
    if (response.ok) return { ok: true };
    const payload: unknown = await response.json().catch(() => null);
    return failure(payload, response.status, "Unable to delete the recording.");
  } catch (error) {
    return networkFailure(error);
  }
}
