import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let socketListener: ((frame: Record<string, unknown>) => void) | null = null;
let shell: { conversations: unknown[]; userProfile: { username?: string } };
let onMediaDisconnected: ((cause: string) => void) | undefined;

const media = {
  state: "idle",
  participants: [],
  connect: vi.fn(),
  disconnect: vi.fn(async () => {}),
};

vi.mock("@/lib/app/AppShellProvider", () => ({
  useAppShell: () => ({
    ...shell,
    subscribeToSocket: (listener: typeof socketListener) => {
      socketListener = listener;
      return () => {
        socketListener = null;
      };
    },
  }),
}));
vi.mock("@/lib/calls/useLiveKitRoom", () => ({
  useLiveKitRoom: ({ onDisconnected }: { onDisconnected?: (cause: string) => void }) => {
    onMediaDisconnected = onDisconnected;
    return media;
  },
}));
vi.mock("@/lib/calls/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/calls/api")>("@/lib/calls/api");
  return {
    ...actual,
    endCall: vi.fn(),
    fetchCalls: vi.fn(),
    joinCall: vi.fn(),
    leaveCall: vi.fn(),
    rejectCall: vi.fn(),
    startCall: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  };
});

import {
  endCall,
  fetchCalls,
  joinCall,
  leaveCall,
  normalizeCall,
  rejectCall,
  startCall,
  startRecording,
  stopRecording,
  type Call,
} from "@/lib/calls/api";
import { CallProvider, useCalls } from "@/lib/calls/CallProvider";
import { deferred } from "@/test/helpers";

const CONNECTION = { url: "wss://livekit.example", token: "jwt", expiresAt: "" };

/** A call as the API and the socket send it. */
function raw(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    conversation: 12,
    call_type: "audio",
    status: "active",
    end_reason: "",
    created_by: { id: 8, username: "alex" },
    created_at: "2026-10-05T12:00:00Z",
    participants: [],
    ...overrides,
  };
}

function call(overrides: Record<string, unknown> = {}): Call {
  return normalizeCall(raw(overrides))!;
}

function frame(type: string, overrides: Record<string, unknown> = {}, extra: object = {}) {
  act(() => socketListener!({ type, call: raw(overrides), ...extra }));
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <CallProvider>{children}</CallProvider>
);

function mount() {
  return renderHook(() => useCalls(), { wrapper });
}

/** A provider with one call already joined. */
async function inCall(overrides: Record<string, unknown> = {}) {
  const view = mount();
  vi.mocked(joinCall).mockResolvedValue({
    ok: true,
    call: call(overrides),
    connection: CONNECTION,
  });
  await act(() => view.result.current.joinCall(31));
  expect(view.result.current.phase).toBe("in-call");
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  socketListener = null;
  onMediaDisconnected = undefined;
  shell = {
    userProfile: { username: "sam" },
    conversations: [
      {
        id: 12,
        kind: "group",
        isAdmin: false,
        participants: [
          { id: "1", username: "sam", userId: "7" },
          { id: "2", username: "alex", userId: "8" },
        ],
      },
      { id: "20", kind: "direct", isAdmin: false, participants: [] },
    ],
  };
  media.connect.mockResolvedValue({ ok: true });
  vi.mocked(fetchCalls).mockResolvedValue({ ok: true, calls: [], hasMore: false });
  vi.mocked(leaveCall).mockResolvedValue({ ok: true, call: call() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CallProvider - starting and joining", () => {
  it("starts idle, and refuses to be used outside itself", () => {
    const { result } = mount();
    expect(result.current).toMatchObject({
      phase: "idle",
      activeCall: null,
      incomingCall: null,
      notice: null,
      error: null,
      canAdministerActiveCall: false,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCalls())).toThrow(
      "useCalls must be used within CallProvider",
    );
    vi.restoreAllMocks();
  });

  it("starts a call and connects its media, camera on for video", async () => {
    const pending = deferred<Awaited<ReturnType<typeof startCall>>>();
    vi.mocked(startCall).mockReturnValue(pending.promise);
    const { result } = mount();

    let started!: Promise<void>;
    act(() => {
      started = result.current.startCall(12, "video");
    });
    expect(result.current.phase).toBe("starting");
    expect(result.current.pendingStart).toEqual({ conversationId: 12, type: "video" });

    // A second press while the first is starting does nothing.
    await act(() => result.current.startCall(12, "video"));
    expect(startCall).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ ok: true, call: call({ call_type: "video" }), connection: CONNECTION });
      await started;
    });
    expect(media.connect).toHaveBeenCalledWith(CONNECTION, { camera: true });
    expect(result.current.phase).toBe("in-call");
    expect(result.current.activeCall?.id).toBe(31);
    expect(result.current.pendingStart).toBeNull();
  });

  it("joins the call already in progress when starting is refused for that", async () => {
    vi.mocked(startCall).mockResolvedValue({
      ok: false,
      message: "A call is live.",
      status: 409,
      existingCallId: 31,
    });
    vi.mocked(joinCall).mockResolvedValue({ ok: true, call: call(), connection: CONNECTION });
    const { result } = mount();
    await act(() => result.current.startCall(12, "audio"));
    expect(joinCall).toHaveBeenCalledWith(31);
    expect(result.current.phase).toBe("in-call");
    expect(result.current.error).toBeNull();
  });

  it("says why a call could not be started", async () => {
    vi.mocked(startCall).mockResolvedValue({
      ok: false,
      message: "Calls are not in your plan.",
    });
    const { result } = mount();
    await act(() => result.current.startCall(12, "audio"));
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBe("Calls are not in your plan.");
    expect(result.current.pendingStart).toBeNull();

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it("brings the current call forward instead of starting another in the same chat", async () => {
    const { result } = await inCall();
    act(() => result.current.setMinimized(true));
    await act(() => result.current.startCall("12", "audio"));
    expect(startCall).not.toHaveBeenCalled();
    expect(result.current.isMinimized).toBe(false);

    act(() => result.current.setMinimized(true));
    await act(() => result.current.joinCall(31));
    expect(joinCall).toHaveBeenCalledTimes(1);
    expect(result.current.isMinimized).toBe(false);
  });

  it("leaves the current call before starting one somewhere else", async () => {
    const { result } = await inCall();
    vi.mocked(startCall).mockResolvedValue({
      ok: true,
      call: call({ id: 40, conversation: 20 }),
      connection: CONNECTION,
    });
    await act(() => result.current.startCall(20, "audio"));
    expect(media.disconnect).toHaveBeenCalled();
    expect(leaveCall).toHaveBeenCalledWith(31);
    expect(result.current.activeCall?.id).toBe(40);
  });

  it("leaves the current call before joining another", async () => {
    const { result } = await inCall();
    vi.mocked(joinCall).mockResolvedValue({
      ok: true,
      call: call({ id: 40, conversation: 20 }),
      connection: CONNECTION,
    });
    await act(() => result.current.joinCall(40));
    expect(leaveCall).toHaveBeenCalledWith(31);
    expect(result.current.activeCall?.id).toBe(40);
  });

  it("says why a call could not be joined", async () => {
    vi.mocked(joinCall).mockResolvedValue({ ok: false, message: "This call has ended." });
    const { result } = mount();
    await act(() => result.current.joinCall(31));
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBe("This call has ended.");
  });

  it("leaves the call on the server when its media will not connect", async () => {
    media.connect.mockResolvedValue({ ok: false, message: "Couldn't connect to the call." });
    vi.mocked(joinCall).mockResolvedValue({ ok: true, call: call(), connection: CONNECTION });
    const { result } = mount();
    await act(() => result.current.joinCall(31));
    expect(leaveCall).toHaveBeenCalledWith(31);
    expect(result.current.phase).toBe("idle");
    expect(result.current.activeCall).toBeNull();
    expect(result.current.error).toBe("Couldn't connect to the call.");
  });

  it("drops media that connects after the call was left", async () => {
    const connecting = deferred<{ ok: true }>();
    media.connect.mockReturnValue(connecting.promise);
    vi.mocked(joinCall).mockResolvedValue({ ok: true, call: call(), connection: CONNECTION });
    const { result } = mount();
    let joining!: Promise<void>;
    await act(async () => {
      joining = result.current.joinCall(31);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(() => result.current.leaveCall());
    media.disconnect.mockClear();

    await act(async () => {
      connecting.resolve({ ok: true });
      await joining;
    });
    expect(media.disconnect).toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });
});

describe("CallProvider - leaving and ending", () => {
  it("leaves quietly, telling the server", async () => {
    const { result } = await inCall();
    await act(() => result.current.leaveCall());
    expect(media.disconnect).toHaveBeenCalled();
    expect(leaveCall).toHaveBeenCalledWith(31);
    expect(result.current).toMatchObject({ phase: "idle", activeCall: null, notice: null });
  });

  it("reports a leave the server refused, having left anyway", async () => {
    const { result } = await inCall();
    vi.mocked(leaveCall).mockResolvedValue({ ok: false, message: "Unable to leave the call." });
    await act(() => result.current.leaveCall());
    expect(result.current.activeCall).toBeNull();
    expect(result.current.error).toBe("Unable to leave the call.");

    // With no call, leaving is a no-op that still settles.
    vi.mocked(leaveCall).mockClear();
    await act(() => result.current.leaveCall());
    expect(leaveCall).not.toHaveBeenCalled();
  });

  it("ends the call for everyone", async () => {
    const { result } = await inCall();
    vi.mocked(endCall).mockResolvedValue({ ok: true, call: call({ status: "ended" }) });
    await act(() => result.current.endCallForEveryone());
    expect(endCall).toHaveBeenCalledWith(31);
    expect(result.current.phase).toBe("idle");
    expect(media.disconnect).toHaveBeenCalled();
  });

  it("stays in the call when ending it is refused", async () => {
    const { result } = await inCall();
    vi.mocked(endCall).mockResolvedValue({ ok: false, message: "Only the host can end it." });
    await act(() => result.current.endCallForEveryone());
    expect(result.current.phase).toBe("in-call");
    expect(result.current.error).toBe("Only the host can end it.");

    await act(() => result.current.leaveCall());
    vi.mocked(endCall).mockClear();
    await act(() => result.current.endCallForEveryone());
    expect(endCall).not.toHaveBeenCalled();
  });

  it("tells the server on the way out when the tab closes mid-call", async () => {
    await inCall();
    window.dispatchEvent(new Event("pagehide"));
    expect(leaveCall).toHaveBeenCalledWith(31, { keepalive: true });
  });

  it("has nothing to tell the server when the tab closes with no call", () => {
    mount();
    window.dispatchEvent(new Event("pagehide"));
    expect(leaveCall).not.toHaveBeenCalled();
  });
});

describe("CallProvider - who may administer", () => {
  it("lets the person who started the call", async () => {
    const { result } = await inCall({ created_by: { id: 7, username: "sam" } });
    expect(result.current.canAdministerActiveCall).toBe(true);
  });

  it("lets a group admin, and either side of a direct chat", async () => {
    shell.conversations = [{ id: 12, kind: "group", isAdmin: true, participants: [] }];
    const admin = await inCall();
    expect(admin.result.current.canAdministerActiveCall).toBe(true);
    admin.unmount();

    shell.conversations = [{ id: 12, kind: "direct", isAdmin: false, participants: [] }];
    const direct = await inCall();
    expect(direct.result.current.canAdministerActiveCall).toBe(true);
  });

  it("does not let an ordinary member", async () => {
    const { result } = await inCall();
    expect(result.current.canAdministerActiveCall).toBe(false);
    expect(result.current.conversationFor(call())?.id).toBe(12);
    expect(result.current.conversationFor(call({ conversation: 999 }))).toBeUndefined();
  });
});

describe("CallProvider - recording", () => {
  it("starts and stops a recording, following what the server says", async () => {
    const { result } = await inCall();
    const pending = deferred<Awaited<ReturnType<typeof startRecording>>>();
    vi.mocked(startRecording).mockReturnValue(pending.promise);

    let toggling!: Promise<void>;
    act(() => {
      toggling = result.current.toggleRecording();
    });
    expect(result.current.isRecordingBusy).toBe(true);
    await act(async () => {
      pending.resolve({ ok: true, recording: { status: "starting" } } as never);
      await toggling;
    });
    expect(result.current.isRecordingBusy).toBe(false);
    expect(result.current.activeCall?.isRecording).toBe(true);

    vi.mocked(stopRecording).mockResolvedValue({
      ok: true,
      recording: { status: "stopping" },
    } as never);
    await act(() => result.current.toggleRecording());
    expect(stopRecording).toHaveBeenCalledWith(31);
    expect(result.current.activeCall?.isRecording).toBe(false);
  });

  it("says why recording could not be changed", async () => {
    const { result } = await inCall();
    vi.mocked(startRecording).mockResolvedValue({
      ok: false,
      message: "Recording is not in your plan.",
    });
    await act(() => result.current.toggleRecording());
    expect(result.current.error).toBe("Recording is not in your plan.");
    expect(result.current.activeCall?.isRecording).toBe(false);

    await act(() => result.current.leaveCall());
    vi.mocked(startRecording).mockClear();
    await act(() => result.current.toggleRecording());
    expect(startRecording).not.toHaveBeenCalled();
  });
});

describe("CallProvider - socket events", () => {
  it("tracks which conversations have a live call", () => {
    const { result } = mount();
    frame("call.accepted");
    expect(Object.keys(result.current.liveCallsByConversation)).toEqual(["12"]);

    frame("call.ended", { status: "ended", conversation: 99 });
    expect(Object.keys(result.current.liveCallsByConversation)).toEqual(["12"]);

    frame("call.ended", { status: "ended" });
    expect(result.current.liveCallsByConversation).toEqual({});
  });

  it("ignores frames that are not about calls", () => {
    const { result } = mount();
    act(() => socketListener!({ type: "message.new" }));
    expect(result.current.liveCallsByConversation).toEqual({});
  });

  it.each([
    ["declined", "Call declined."],
    ["unanswered", "No answer."],
    ["timed_out", "The call reached its time limit."],
    ["ended", "Call ended."],
  ])("explains a call that ended as %s", async (reason, notice) => {
    const { result } = await inCall();
    frame("call.ended", { status: "ended", end_reason: reason });
    expect(result.current.phase).toBe("ended");
    expect(result.current.notice).toBe(notice);
    expect(result.current.activeCall).toBeNull();
    expect(media.disconnect).toHaveBeenCalled();

    act(() => result.current.dismissNotice());
    expect(result.current.phase).toBe("idle");
    expect(result.current.notice).toBeNull();
  });

  it("keeps the active call in step with other events", async () => {
    const { result } = await inCall();
    frame("call.recording.started", { is_recording: true });
    expect(result.current.activeCall?.isRecording).toBe(true);
    expect(result.current.phase).toBe("in-call");

    // Dismissing a notice while in a call leaves the call alone.
    act(() => result.current.dismissNotice());
    expect(result.current.phase).toBe("in-call");
  });

  it("rings for an incoming call", () => {
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    expect(result.current.incomingCall?.id).toBe(31);
  });

  it("does not ring for the call already joined", async () => {
    const { result } = await inCall();
    frame("call.incoming", { status: "ringing" });
    expect(result.current.incomingCall).toBeNull();
  });

  it("stops ringing when the call ends, or this account answers elsewhere", () => {
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    frame("call.ended", { status: "ended" });
    expect(result.current.incomingCall).toBeNull();

    frame("call.incoming", { status: "ringing" });
    frame("call.accepted", {}, { user_id: 7 });
    expect(result.current.incomingCall).toBeNull();
  });

  it("keeps ringing when somebody else answers, or another call changes", () => {
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    frame("call.accepted", {}, { user_id: 8 });
    expect(result.current.incomingCall?.status).toBe("active");

    frame("call.accepted", { id: 77, conversation: 20 }, { user_id: 7 });
    expect(result.current.incomingCall?.id).toBe(31);
  });

  it("does not know who this account is in a chat without a username", () => {
    shell.userProfile = {};
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    frame("call.accepted", {}, { user_id: 7 });
    expect(result.current.incomingCall).not.toBeNull();
  });

  it("stops ringing by itself after a minute", () => {
    vi.useFakeTimers();
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.incomingCall).toBeNull();
  });
});

describe("CallProvider - answering", () => {
  it("accepts an incoming call by joining it", async () => {
    vi.mocked(joinCall).mockResolvedValue({ ok: true, call: call(), connection: CONNECTION });
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    await act(() => result.current.acceptIncomingCall());
    expect(joinCall).toHaveBeenCalledWith(31);
    expect(result.current.incomingCall).toBeNull();
    expect(result.current.phase).toBe("in-call");
  });

  it("declines, staying quiet when the call had already moved on", async () => {
    vi.mocked(rejectCall).mockResolvedValue({ ok: false, message: "Gone.", status: 409 });
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    await act(async () => result.current.declineIncomingCall());
    expect(rejectCall).toHaveBeenCalledWith(31);
    expect(result.current.incomingCall).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reports a decline that genuinely failed", async () => {
    vi.mocked(rejectCall).mockResolvedValue({
      ok: false,
      message: "Unable to decline the call.",
      status: 500,
    });
    const { result } = mount();
    frame("call.incoming", { status: "ringing" });
    await act(async () => result.current.declineIncomingCall());
    await waitFor(() => expect(result.current.error).toBe("Unable to decline the call."));
  });

  it("has nothing to accept or decline when nothing is ringing", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.acceptIncomingCall();
      result.current.declineIncomingCall();
    });
    expect(joinCall).not.toHaveBeenCalled();
    expect(rejectCall).not.toHaveBeenCalled();
  });
});

describe("CallProvider - calls already live on arrival", () => {
  it("lists them, and rings for a recent one this account is not in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:30Z"));
    vi.mocked(fetchCalls).mockImplementation(async (options) => ({
      ok: true,
      hasMore: false,
      calls:
        options?.status === "ringing"
          ? [call({ status: "ringing" })]
          : [call({ id: 50, conversation: 20 })],
    }));
    const { result } = mount();
    await waitFor(() => expect(result.current.incomingCall?.id).toBe(31));
    expect(Object.keys(result.current.liveCallsByConversation).sort()).toEqual(["12", "20"]);
    expect(fetchCalls).toHaveBeenCalledWith({ status: "ringing" });
    expect(fetchCalls).toHaveBeenCalledWith({ status: "active" });
  });

  it.each([
    ["one this account started", { created_by: { id: 7, username: "sam" } }],
    ["one that has rung for over a minute", { created_at: "2026-10-05T11:00:00Z" }],
    [
      "one this account is already in",
      { participants: [{ id: 1, user: { id: 7, username: "sam" }, left_at: null }] },
    ],
  ])("does not ring for %s", async (_name, overrides) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:30Z"));
    vi.mocked(fetchCalls).mockImplementation(async (options) => ({
      ok: true,
      hasMore: false,
      calls: options?.status === "ringing" ? [call({ status: "ringing", ...overrides })] : [],
    }));
    const { result } = mount();
    await waitFor(() =>
      expect(Object.keys(result.current.liveCallsByConversation)).toEqual(["12"]),
    );
    expect(result.current.incomingCall).toBeNull();
  });

  it("does not ask until it knows who is signed in, and copes with a failed load", async () => {
    shell.userProfile = {};
    const anonymous = mount();
    expect(fetchCalls).not.toHaveBeenCalled();
    anonymous.unmount();

    shell.userProfile = { username: "sam" };
    vi.mocked(fetchCalls).mockResolvedValue({ ok: false, message: "down" });
    const { result } = mount();
    await waitFor(() => expect(fetchCalls).toHaveBeenCalledTimes(2));
    expect(result.current.liveCallsByConversation).toEqual({});
  });

  it("ignores a list that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCalls>>>();
    vi.mocked(fetchCalls).mockReturnValue(pending.promise);
    const { unmount } = mount();
    unmount();
    pending.resolve({ ok: true, calls: [call()], hasMore: false });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("CallProvider - losing the media connection", () => {
  it("says the call ended when the server closed the room", async () => {
    const { result } = await inCall();
    act(() => onMediaDisconnected!("ended"));
    expect(result.current.notice).toBe("Call ended.");
    expect(result.current.phase).toBe("ended");
  });

  it("says so when this account joined from another device", async () => {
    const { result } = await inCall();
    act(() => onMediaDisconnected!("replaced"));
    expect(result.current.notice).toBe("You joined this call from another device.");
  });

  it("ignores a disconnect it asked for, or one with no call", async () => {
    const { result } = await inCall();
    act(() => onMediaDisconnected!("left"));
    expect(result.current.phase).toBe("in-call");

    await act(() => result.current.leaveCall());
    act(() => onMediaDisconnected!("lost"));
    expect(joinCall).toHaveBeenCalledTimes(1);
  });

  it("rejoins by itself when the network drops", async () => {
    const { result } = await inCall();
    await act(async () => onMediaDisconnected!("lost"));
    await waitFor(() => expect(joinCall).toHaveBeenCalledTimes(2));
    expect(result.current.phase).toBe("in-call");
  });

  it("gives up after two failed attempts, and leaves on the server", async () => {
    const { result } = await inCall();
    media.connect.mockResolvedValue({ ok: false, message: "Couldn't connect to the call." });
    await act(async () => onMediaDisconnected!("lost"));
    await waitFor(() => expect(result.current.activeCall).toBeNull());
    expect(result.current.error).toBe("Couldn't connect to the call.");
  });

  it("stops trying once it has used its attempts", async () => {
    const { result } = await inCall();
    // Each attempt reaches the server but the media drops again straight away.
    const dropping = deferred<{ ok: true }>();
    media.connect.mockReturnValue(dropping.promise);
    await act(async () => onMediaDisconnected!("lost"));
    await act(async () => onMediaDisconnected!("lost"));
    await act(async () => onMediaDisconnected!("lost"));
    expect(result.current.error).toBe("Lost connection to the call.");
    expect(result.current.activeCall).toBeNull();
    expect(leaveCall).toHaveBeenCalledWith(31);
  });

  it("treats a rejoin refused with 409 as the call having ended", async () => {
    const { result } = await inCall();
    vi.mocked(joinCall).mockResolvedValue({ ok: false, message: "Gone.", status: 409 });
    await act(async () => onMediaDisconnected!("lost"));
    await waitFor(() => expect(result.current.notice).toBe("Call ended."));
    expect(result.current.error).toBeNull();
  });

  it("reports any other refusal to rejoin", async () => {
    const { result } = await inCall();
    vi.mocked(joinCall).mockResolvedValue({ ok: false, message: "Server error.", status: 500 });
    await act(async () => onMediaDisconnected!("lost"));
    await waitFor(() => expect(result.current.error).toBe("Server error."));
    expect(result.current.phase).toBe("idle");
    expect(result.current.notice).toBeNull();
  });

  it("drops a rejoin answer for a call that was left meanwhile", async () => {
    const { result } = await inCall();
    const rejoining = deferred<Awaited<ReturnType<typeof joinCall>>>();
    vi.mocked(joinCall).mockReturnValue(rejoining.promise);
    await act(async () => onMediaDisconnected!("lost"));
    await act(() => result.current.leaveCall());
    media.connect.mockClear();
    await act(async () =>
      rejoining.resolve({ ok: true, call: call(), connection: CONNECTION }),
    );
    expect(media.connect).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("rejoins on request with a fresh set of attempts", async () => {
    const { result } = await inCall();
    await act(() => result.current.rejoinActiveCall());
    expect(joinCall).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("in-call");

    await act(() => result.current.leaveCall());
    await act(() => result.current.rejoinActiveCall());
    expect(joinCall).toHaveBeenCalledTimes(2);
  });
});
