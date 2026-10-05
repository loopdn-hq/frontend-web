import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  currentStays,
  deleteRecording,
  endCall,
  fetchCall,
  fetchCallRecordings,
  fetchCalls,
  fetchRecording,
  isCallLive,
  joinCall,
  leaveCall,
  normalizeCall,
  rejectCall,
  startCall,
  startRecording,
  stopRecording,
} from "@/lib/calls/api";
import { parseCallEvent } from "@/lib/calls/events";
import { authorizedRequest } from "@/lib/chat/conversations";
import { brokenResponse, jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  return { path, init: (init ?? {}) as RequestInit };
}

const SAM = {
  id: 7,
  username: "sam",
  profile: { display_label: "Sam Wren", avatar_url: "https://cdn/sam.png" },
};

const CALL = {
  id: 31,
  conversation: "12",
  call_type: "video",
  status: "active",
  end_reason: "",
  created_by: SAM,
  started_at: "2026-10-05T12:00:00Z",
  ended_at: null,
  created_at: "2026-10-05T11:59:50Z",
  participant_count: 2,
  is_recording: true,
  participants: [
    { id: 1, user: SAM, joined_at: "2026-10-05T12:00:00Z", left_at: null },
    {
      id: 2,
      user: { id: 8, username: "alex" },
      joined_at: "2026-10-05T12:00:05Z",
      left_at: "2026-10-05T12:03:05Z",
      duration: 180,
    },
    { id: 3, user: null },
    "junk",
  ],
};

const LIVEKIT = {
  url: "wss://livekit.example",
  token: "jwt",
  expires_at: "2026-10-05T13:00:00Z",
};

const RECORDING = {
  id: 5,
  call: 31,
  status: "completed",
  started_by: SAM,
  started_at: "2026-10-05T12:01:00Z",
  ended_at: "2026-10-05T12:05:00Z",
  duration_seconds: 240,
  size_bytes: 1048576,
  content_type: "video/mp4",
  expires_at: "2026-11-05T12:05:00Z",
  deleted_at: null,
  download_url: "https://cdn/rec.mp4",
};

/** Every call fails the same way when the request itself does. */
async function expectNetworkFailure(call: () => Promise<unknown>) {
  vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
  expect(await call()).toEqual({ ok: false, message: "Signed out." });
  vi.mocked(authorizedRequest).mockRejectedValue(new Error(""));
  expect(await call()).toEqual({
    ok: false,
    message: "Network error. Please try again.",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeCall", () => {
  it("reads a call and who is and was on it", () => {
    const call = normalizeCall(CALL)!;
    expect(call).toMatchObject({
      id: 31,
      conversationId: 12,
      type: "video",
      status: "active",
      endReason: "",
      startedAt: "2026-10-05T12:00:00Z",
      endedAt: null,
      participantCount: 2,
      isRecording: true,
    });
    expect(call.createdBy).toEqual({
      id: "7",
      username: "sam",
      name: "Sam Wren",
      avatarUrl: "https://cdn/sam.png",
    });
    expect(call.participants).toEqual([
      {
        id: "1",
        user: call.createdBy,
        joinedAt: "2026-10-05T12:00:00Z",
        leftAt: null,
        duration: null,
      },
      {
        id: "2",
        user: { id: "8", username: "alex", name: "alex", avatarUrl: undefined },
        joinedAt: "2026-10-05T12:00:05Z",
        leftAt: "2026-10-05T12:03:05Z",
        duration: 180,
      },
    ]);
    expect(currentStays(call).map((stay) => stay.id)).toEqual(["1"]);
    expect(isCallLive(call)).toBe(true);
  });

  it("falls back for anything missing or unrecognised", () => {
    const call = normalizeCall({
      id: 1,
      status: "odd",
      end_reason: "exploded",
      created_by: { id: null },
      participants: "none",
    })!;
    expect(call).toEqual({
      id: 1,
      conversationId: Number.NaN,
      type: "audio",
      status: "ringing",
      endReason: "",
      createdBy: null,
      startedAt: null,
      endedAt: null,
      createdAt: "",
      participantCount: 0,
      isRecording: false,
      participants: [],
    });
  });

  it("keeps a known end reason, and names a user with no name", () => {
    const call = normalizeCall({
      id: 1,
      status: "ended",
      end_reason: "unanswered",
      created_by: { id: 3 },
    })!;
    expect(call.endReason).toBe("unanswered");
    expect(call.createdBy?.name).toBe("Someone");
    expect(isCallLive(call)).toBe(false);
  });

  it("refuses what is not a call", () => {
    expect(normalizeCall({ id: "31" })).toBeNull();
    expect(normalizeCall(null)).toBeNull();
    expect(normalizeCall([])).toBeNull();
  });
});

describe("parseCallEvent", () => {
  it("reads a call frame from the socket", () => {
    expect(
      parseCallEvent({
        type: "call.recording.started",
        call: CALL,
        user_id: 7,
        recording_id: 5,
      }),
    ).toMatchObject({
      type: "call.recording.started",
      callId: 31,
      conversationId: 12,
      userId: "7",
      recordingId: 5,
    });
  });

  it("reads a system event as caused by nobody", () => {
    const event = parseCallEvent({ type: "call.ended", call: CALL, user_id: null });
    expect(event?.userId).toBeNull();
    expect(event?.recordingId).toBeUndefined();
    expect(parseCallEvent({ type: "call.ended", call: CALL })?.userId).toBeNull();
  });

  it("ignores other frames, and a call frame with no call", () => {
    expect(parseCallEvent({ type: "message.new", call: CALL })).toBeNull();
    expect(parseCallEvent({ type: "call.incoming", call: {} })).toBeNull();
  });
});

describe("startCall", () => {
  it("starts a call and returns how to connect to it", async () => {
    respond(201, { data: { call: CALL, livekit: LIVEKIT } });
    const result = await startCall("12", "video");

    expect(lastRequest().path).toBe("/calls/");
    expect(lastRequest().init.method).toBe("POST");
    expect(JSON.parse(lastRequest().init.body as string)).toEqual({
      conversation: 12,
      call_type: "video",
    });
    expect(result).toMatchObject({
      ok: true,
      call: { id: 31 },
      connection: {
        url: "wss://livekit.example",
        token: "jwt",
        expiresAt: "2026-10-05T13:00:00Z",
      },
    });
  });

  it("points at the call already in progress on a 409", async () => {
    respond(409, { message: "A call is live.", data: { call_id: 30 } });
    expect(await startCall(12, "audio")).toEqual({
      ok: false,
      message: "A call is live.",
      status: 409,
      existingCallId: 30,
    });

    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(409));
    expect(await startCall(12, "audio")).toEqual({
      ok: false,
      message: "There is already a call in progress here.",
      status: 409,
      existingCallId: undefined,
    });
  });

  it("fails when the answer is missing the call or the connection", async () => {
    respond(201, { data: { call: CALL, livekit: { url: "", token: "jwt" } } });
    expect(await startCall(12, "audio")).toEqual({
      ok: false,
      message: "Unable to start the call.",
      status: 201,
    });
    respond(201, { data: { call: CALL } });
    expect(await startCall(12, "audio")).toMatchObject({ ok: false });
    respond(201, { data: null });
    expect(await startCall(12, "audio")).toMatchObject({ ok: false });
    respond(201, "odd");
    expect(await startCall(12, "audio")).toMatchObject({ ok: false });
  });

  it("reports a refusal and a dead network", async () => {
    respond(403, { message: "You are not in this conversation." });
    expect(await startCall(12, "audio")).toEqual({
      ok: false,
      message: "You are not in this conversation.",
      status: 403,
    });
    await expectNetworkFailure(() => startCall(12, "audio"));
  });
});

describe("joining and leaving", () => {
  it("joins a call", async () => {
    respond(200, { data: { call: CALL, livekit: LIVEKIT } });
    expect(await joinCall(31)).toMatchObject({ ok: true, call: { id: 31 } });
    expect(lastRequest().path).toBe("/calls/31/join/");

    respond(410, {});
    expect(await joinCall(31)).toEqual({
      ok: false,
      message: "Unable to join the call.",
      status: 410,
    });
    await expectNetworkFailure(() => joinCall(31));
  });

  it("leaves a call, with keepalive when the tab is closing", async () => {
    respond(200, { data: { call: CALL } });
    expect(await leaveCall(31)).toMatchObject({ ok: true, call: { id: 31 } });
    expect(lastRequest().init.keepalive).toBe(false);

    await leaveCall(31, { keepalive: true });
    expect(lastRequest().path).toBe("/calls/31/leave/");
    expect(lastRequest().init.keepalive).toBe(true);
    await expectNetworkFailure(() => leaveCall(31));
  });

  it("declines, ends and fetches a call, wrapped or bare", async () => {
    respond(200, { data: CALL });
    expect(await rejectCall(31)).toMatchObject({ ok: true, call: { id: 31 } });
    expect(lastRequest().path).toBe("/calls/31/reject/");

    respond(200, { data: { call: CALL } });
    expect(await endCall(31)).toMatchObject({ ok: true, call: { id: 31 } });
    expect(lastRequest().path).toBe("/calls/31/end/");

    respond(200, { data: CALL });
    expect(await fetchCall(31)).toMatchObject({ ok: true, call: { id: 31 } });
    expect(lastRequest().path).toBe("/calls/31/");
  });

  it("names what failed for each of them", async () => {
    respond(500, {});
    expect(await rejectCall(31)).toMatchObject({
      message: "Unable to decline the call.",
    });
    expect(await endCall(31)).toMatchObject({
      message: "Unable to end the call.",
    });
    expect(await leaveCall(31)).toMatchObject({
      message: "Unable to leave the call.",
    });

    respond(200, { data: { call: null } });
    expect(await fetchCall(31)).toEqual({
      ok: false,
      message: "Unable to load the call.",
      status: 200,
    });

    await expectNetworkFailure(() => rejectCall(31));
    await expectNetworkFailure(() => endCall(31));
    await expectNetworkFailure(() => fetchCall(31));
  });
});

describe("fetchCalls", () => {
  it("lists calls, paginated or bare", async () => {
    respond(200, { data: { results: [CALL, { id: "x" }], next: "page2" } });
    const paged = await fetchCalls();
    expect(lastRequest().path).toBe("/calls/");
    expect(paged).toMatchObject({ ok: true, hasMore: true });
    expect(paged.ok && paged.calls).toHaveLength(1);

    respond(200, { data: [CALL] });
    expect(await fetchCalls()).toMatchObject({ ok: true, hasMore: false });

    respond(200, { data: "odd" });
    expect(await fetchCalls()).toEqual({ ok: true, calls: [], hasMore: false });
  });

  it("puts the filters in the query, leaving out page one", async () => {
    respond(200, { data: [] });
    await fetchCalls({ page: 1, conversationId: 12, status: "ended" });
    expect(lastRequest().path).toBe("/calls/?conversation=12&status=ended");
    await fetchCalls({ page: 2 });
    expect(lastRequest().path).toBe("/calls/?page=2");
  });

  it("reports a failure", async () => {
    respond(500, { message: "Calls are down." });
    expect(await fetchCalls()).toEqual({
      ok: false,
      message: "Calls are down.",
      status: 500,
    });
    await expectNetworkFailure(() => fetchCalls());
  });
});

describe("recordings", () => {
  it("starts, stops and fetches a recording", async () => {
    respond(201, { data: RECORDING });
    expect(await startRecording(31)).toEqual({
      ok: true,
      recording: {
        id: 5,
        callId: 31,
        status: "completed",
        startedBy: {
          id: "7",
          username: "sam",
          name: "Sam Wren",
          avatarUrl: "https://cdn/sam.png",
        },
        startedAt: "2026-10-05T12:01:00Z",
        endedAt: "2026-10-05T12:05:00Z",
        durationSeconds: 240,
        sizeBytes: 1048576,
        contentType: "video/mp4",
        expiresAt: "2026-11-05T12:05:00Z",
        deletedAt: null,
        downloadUrl: "https://cdn/rec.mp4",
      },
    });
    expect(lastRequest().path).toBe("/calls/31/recording/start/");

    await stopRecording(31);
    expect(lastRequest().path).toBe("/calls/31/recording/stop/");

    await fetchRecording(5);
    expect(lastRequest().path).toBe("/recordings/5/");
  });

  it("treats a status it does not know as failed", async () => {
    respond(200, { data: { id: 5, status: "paused" } });
    const result = await fetchRecording(5);
    expect(result.ok && result.recording.status).toBe("failed");
    expect(result.ok && result.recording.startedBy).toBeNull();
  });

  it("names what failed for each of them", async () => {
    respond(403, {});
    expect(await startRecording(31)).toEqual({
      ok: false,
      message: "Unable to start recording.",
      status: 403,
    });
    expect(await stopRecording(31)).toMatchObject({
      message: "Unable to stop recording.",
    });
    respond(200, { data: { status: "completed" } });
    expect(await fetchRecording(5)).toEqual({
      ok: false,
      message: "Unable to load the recording.",
      status: 200,
    });

    await expectNetworkFailure(() => startRecording(31));
    await expectNetworkFailure(() => stopRecording(31));
    await expectNetworkFailure(() => fetchRecording(5));
  });

  it("lists a call's recordings, paginated or bare", async () => {
    respond(200, { data: [RECORDING, null] });
    const bare = await fetchCallRecordings(31);
    expect(lastRequest().path).toBe("/calls/31/recordings/");
    expect(bare.ok && bare.recordings).toHaveLength(1);

    respond(200, { data: { results: [RECORDING] } });
    const paged = await fetchCallRecordings(31);
    expect(paged.ok && paged.recordings).toHaveLength(1);

    respond(200, {});
    expect(await fetchCallRecordings(31)).toEqual({ ok: true, recordings: [] });

    respond(500, {});
    expect(await fetchCallRecordings(31)).toMatchObject({
      message: "Unable to load recordings.",
    });
    await expectNetworkFailure(() => fetchCallRecordings(31));
  });

  it("deletes a recording", async () => {
    respond(204, null);
    expect(await deleteRecording(5)).toEqual({ ok: true });
    expect(lastRequest()).toEqual({
      path: "/recordings/5/",
      init: { method: "DELETE" },
    });

    respond(403, { message: "Only the host can delete this." });
    expect(await deleteRecording(5)).toEqual({
      ok: false,
      message: "Only the host can delete this.",
      status: 403,
    });
    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(500));
    expect(await deleteRecording(5)).toMatchObject({
      message: "Unable to delete the recording.",
    });
    await expectNetworkFailure(() => deleteRecording(5));
  });
});
