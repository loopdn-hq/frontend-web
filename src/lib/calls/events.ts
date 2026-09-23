import { normalizeCall, type Call } from "@/lib/calls/api";

/**
 * The `call.*` frames the app socket carries (chat/consumers.py,
 * `send_call_frame`). Application events only - who started, answered,
 * declined or ended a call. The media itself never comes this way.
 */
export type CallEventType =
  | "call.incoming"
  | "call.accepted"
  | "call.rejected"
  | "call.ended"
  | "call.recording.started"
  | "call.recording.stopped";

export type CallSocketEvent = {
  type: CallEventType;
  callId: number;
  conversationId: number;
  /** The account that caused it. Null when the system did (a timeout). */
  userId: string | null;
  /** The call as it is after the event, same shape as GET /calls/<id>/. */
  call: Call;
  recordingId?: number;
};

const CALL_EVENT_TYPES: readonly string[] = [
  "call.incoming",
  "call.accepted",
  "call.rejected",
  "call.ended",
  "call.recording.started",
  "call.recording.stopped",
];

export function parseCallEvent(message: {
  type: string;
  [key: string]: unknown;
}): CallSocketEvent | null {
  if (!CALL_EVENT_TYPES.includes(message.type)) return null;

  const call = normalizeCall(message.call);
  if (!call) return null;

  return {
    type: message.type as CallEventType,
    callId: call.id,
    conversationId: call.conversationId,
    userId:
      message.user_id === null || message.user_id === undefined
        ? null
        : String(message.user_id),
    call,
    recordingId:
      typeof message.recording_id === "number"
        ? message.recording_id
        : undefined,
  };
}
