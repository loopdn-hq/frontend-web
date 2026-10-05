import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let calls: Record<string, unknown>;
let conversations: Record<string, unknown>[];

vi.mock("@/lib/calls/CallProvider", () => ({ useCalls: () => calls }));
vi.mock("@/lib/app/AppShellProvider", () => ({
  useAppShell: () => ({ conversations }),
}));

import {
  ActiveCallView,
  MinimizedCallBar,
} from "@/components/calls/ActiveCallView";
import { CallControls } from "@/components/calls/CallControls";
import { CallLayer } from "@/components/calls/CallLayer";
import { ConversationCallButtons } from "@/components/calls/ConversationCallButtons";
import { IncomingCallPrompt } from "@/components/calls/IncomingCallPrompt";
import {
  AudioTrackPlayer,
  VideoTrackView,
} from "@/components/calls/MediaTracks";
import { ParticipantTile } from "@/components/calls/ParticipantTile";
import { normalizeCall, type Call } from "@/lib/calls/api";
import type { CallMediaParticipant } from "@/lib/calls/useLiveKitRoom";

function track(sid = "t1") {
  return {
    sid,
    attach: vi.fn(),
    detach: vi.fn(),
    mediaStreamTrack: { id: `media-${sid}` },
  };
}

function participant(
  overrides: Partial<CallMediaParticipant> = {},
): CallMediaParticipant {
  return {
    identity: "7",
    name: "Sam",
    isLocal: true,
    isSpeaking: false,
    isMicrophoneEnabled: true,
    audioTracks: [],
    poorConnection: false,
    ...overrides,
  };
}

function call(overrides: Record<string, unknown> = {}): Call {
  return normalizeCall({
    id: 31,
    conversation: 12,
    call_type: "audio",
    status: "active",
    created_by: {
      id: 8,
      username: "alex",
      profile: { display_label: "Alex Sato" },
    },
    created_at: "2026-10-05T12:00:00Z",
    started_at: "2026-10-05T12:00:00Z",
    participants: [
      {
        id: 1,
        user: {
          id: 8,
          username: "alex",
          profile: { avatar_url: "https://cdn.example/a.png" },
        },
        left_at: null,
      },
      {
        id: 2,
        user: { id: 7, username: "sam" },
        left_at: "2026-10-05T12:01:00Z",
      },
    ],
    ...overrides,
  })!;
}

function media(overrides: Record<string, unknown> = {}) {
  return {
    state: "connected",
    participants: [participant()],
    deviceError: null,
    clearDeviceError: vi.fn(),
    audioBlocked: false,
    startAudio: vi.fn(async () => {}),
    screenShareSupport: "ready",
    isMicrophoneEnabled: true,
    isCameraEnabled: false,
    isScreenSharing: false,
    toggleMicrophone: vi.fn(async () => {}),
    toggleCamera: vi.fn(async () => {}),
    toggleScreenShare: vi.fn(async () => {}),
    ...overrides,
  };
}

function useCallsIs(overrides: Record<string, unknown> = {}) {
  calls = {
    phase: "in-call",
    activeCall: call(),
    pendingStart: null,
    incomingCall: null,
    liveCallsByConversation: {},
    notice: null,
    error: null,
    isMinimized: false,
    isRecordingBusy: false,
    canAdministerActiveCall: false,
    media: media(),
    startCall: vi.fn(async () => {}),
    joinCall: vi.fn(async () => {}),
    acceptIncomingCall: vi.fn(async () => {}),
    declineIncomingCall: vi.fn(),
    leaveCall: vi.fn(async () => {}),
    endCallForEveryone: vi.fn(async () => {}),
    toggleRecording: vi.fn(async () => {}),
    setMinimized: vi.fn(),
    dismissNotice: vi.fn(),
    dismissError: vi.fn(),
    conversationFor: (target: Call) =>
      conversations.find(
        (row) => String(row.id) === String(target.conversationId),
      ),
    ...overrides,
  };
  return calls as Record<string, ReturnType<typeof vi.fn>> & {
    media: ReturnType<typeof media>;
  };
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  conversations = [
    {
      id: 12,
      kind: "group",
      name: "Book club",
      logoImage: "https://cdn.example/club.png",
    },
    { id: 20, kind: "direct", name: "Alex Sato", logoImage: null },
  ];
  useCallsIs();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("media elements", () => {
  it("attaches a video track to its element, and detaches it afterwards", () => {
    const video = track();
    const { container, unmount, rerender } = render(
      <VideoTrackView track={video as never} mirror className="h-full" />,
    );
    const element = container.querySelector("video")!;
    expect(video.attach).toHaveBeenCalledWith(element);
    expect(element).toHaveClass("object-cover", "-scale-x-100", "h-full");
    expect(element.muted).toBe(true);

    const next = track("t2");
    rerender(<VideoTrackView track={next as never} fit="contain" />);
    expect(video.detach).toHaveBeenCalledWith(element);
    expect(next.attach).toHaveBeenCalled();
    expect(element).toHaveClass("object-contain");

    unmount();
    expect(next.detach).toHaveBeenCalled();
  });

  it("plays an audio track, and stops when it goes", () => {
    const audio = track();
    const { container, unmount } = render(
      <AudioTrackPlayer track={audio as never} />,
    );
    expect(audio.attach).toHaveBeenCalledWith(container.querySelector("audio"));
    unmount();
    expect(audio.detach).toHaveBeenCalled();
  });
});

describe("ParticipantTile", () => {
  it("shows an avatar, a mute mark and a weak-signal mark for somebody off camera", () => {
    const { container } = render(
      <ParticipantTile
        participant={participant({
          name: "Alex",
          isLocal: false,
          isMicrophoneEnabled: false,
          poorConnection: true,
          isSpeaking: true,
        })}
        avatarUrl="https://cdn.example/a.png"
        className="extra"
      />,
    );
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByLabelText("Muted")).toBeInTheDocument();
    expect(screen.getByLabelText("Poor connection")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/a.png",
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.firstElementChild).toHaveClass(
      "ring-emerald-400",
      "extra",
    );
  });

  it("mirrors your own camera, and names it as yours", () => {
    const { container } = render(
      <ParticipantTile
        participant={participant({ cameraTrack: track() as never })}
        compact
      />,
    );
    expect(screen.getByText("Sam (you)")).toBeInTheDocument();
    expect(container.querySelector("video")).toHaveClass("-scale-x-100");
    expect(container.firstElementChild).toHaveClass("ring-transparent");
  });

  it("shows a shared screen whole, unmirrored, without the mute mark", () => {
    const mine = render(
      <ParticipantTile
        participant={participant({
          isMicrophoneEnabled: false,
          isSpeaking: true,
        })}
        track={track() as never}
        isScreen
      />,
    );
    expect(screen.getByText("Your screen")).toBeInTheDocument();
    expect(mine.container.querySelector("video")).toHaveClass("object-contain");
    expect(mine.container.querySelector("video")).not.toHaveClass(
      "-scale-x-100",
    );
    expect(screen.queryByLabelText("Muted")).not.toBeInTheDocument();
    expect(mine.container.firstElementChild).toHaveClass("ring-transparent");
    mine.unmount();

    render(
      <ParticipantTile
        participant={participant({ name: "Alex", isLocal: false })}
        track={track() as never}
        isScreen
      />,
    );
    expect(screen.getByText("Alex's screen")).toBeInTheDocument();
  });
});

describe("CallControls", () => {
  it("renders nothing without a call", () => {
    useCallsIs({ activeCall: null });
    expect(render(<CallControls />).container).toBeEmptyDOMElement();
  });

  it("mutes, shares and leaves in a group audio call", () => {
    const state = useCallsIs();
    render(<CallControls />);
    expect(
      screen.queryByRole("button", { name: /camera/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /record/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "End for everyone" }),
    ).not.toBeInTheDocument();

    click("Mute");
    expect(state.media.toggleMicrophone).toHaveBeenCalled();
    click("Share your screen");
    expect(state.media.toggleScreenShare).toHaveBeenCalled();
    click("Leave call");
    expect(state.leaveCall).toHaveBeenCalled();
    expect(state.endCallForEveryone).not.toHaveBeenCalled();
  });

  it("offers the camera on a video call, and reflects each device's state", () => {
    const state = useCallsIs({
      activeCall: call({ call_type: "video" }),
      media: media({
        isMicrophoneEnabled: false,
        isCameraEnabled: true,
        isScreenSharing: true,
      }),
    });
    render(<CallControls />);
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    click("Turn camera off");
    expect(state.media.toggleCamera).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop sharing" })).toBeEnabled();
  });

  it("offers to turn the camera on when it is off", () => {
    useCallsIs({ activeCall: call({ call_type: "video" }) });
    render(<CallControls />);
    expect(
      screen.getByRole("button", { name: "Turn camera on" }),
    ).toBeInTheDocument();
  });

  it("says why the screen cannot be shared rather than hiding the button", () => {
    useCallsIs({ media: media({ screenShareSupport: "not-in-plan" }) });
    const first = render(<CallControls />);
    expect(
      screen.getByRole("button", {
        name: "Screen sharing isn't included in this plan",
      }),
    ).toBeDisabled();
    first.unmount();

    useCallsIs({ media: media({ screenShareSupport: "unsupported" }) });
    render(<CallControls />);
    expect(
      screen.getByRole("button", { name: "This browser can't share a screen" }),
    ).toBeDisabled();
  });

  it("locks the devices until the media is connected, but never the hang-up", () => {
    useCallsIs({
      media: media({ state: "connecting" }),
      canAdministerActiveCall: true,
    });
    render(<CallControls />);
    expect(screen.getByRole("button", { name: "Mute" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Record" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave call" })).toBeEnabled();
  });

  it("lets whoever runs a group call record it, or end it for everyone", () => {
    const state = useCallsIs({
      canAdministerActiveCall: true,
      media: media({ state: "reconnecting" }),
    });
    render(<CallControls />);
    click("Record");
    expect(state.toggleRecording).toHaveBeenCalled();
    click("End for everyone");
    expect(state.endCallForEveryone).toHaveBeenCalledTimes(1);
    click("Leave call");
    expect(state.leaveCall).toHaveBeenCalled();
  });

  it("shows a recording in progress, and waits while it is changing", () => {
    useCallsIs({
      canAdministerActiveCall: true,
      isRecordingBusy: true,
      activeCall: call({ is_recording: true }),
    });
    render(<CallControls />);
    expect(
      screen.getByRole("button", { name: "Stop recording" }),
    ).toBeDisabled();
  });

  it("hangs up for both sides of a one-to-one, like a phone", () => {
    const state = useCallsIs({
      activeCall: call({ conversation: 20 }),
      canAdministerActiveCall: true,
    });
    render(<CallControls />);
    expect(
      screen.queryByRole("button", { name: "End for everyone" }),
    ).not.toBeInTheDocument();
    click("End call");
    expect(state.endCallForEveryone).toHaveBeenCalled();
    expect(state.leaveCall).not.toHaveBeenCalled();
  });
});

describe("IncomingCallPrompt", () => {
  it("renders nothing when nothing is ringing", () => {
    expect(render(<IncomingCallPrompt />).container).toBeEmptyDOMElement();
  });

  it("names the group and who started the call", () => {
    const state = useCallsIs({
      activeCall: null,
      incomingCall: call({ status: "ringing" }),
    });
    render(<IncomingCallPrompt />);
    const prompt = screen.getByRole("alertdialog", {
      name: "Incoming voice call from Alex Sato",
    });
    expect(prompt).toHaveTextContent("Book club");
    expect(prompt).toHaveTextContent("Alex Sato started a voice call");

    click("Join");
    expect(state.acceptIncomingCall).toHaveBeenCalled();
    click("Decline");
    expect(state.declineIncomingCall).toHaveBeenCalled();
  });

  it("names the caller for a one-to-one video call", () => {
    useCallsIs({
      activeCall: null,
      incomingCall: call({
        status: "ringing",
        conversation: 20,
        call_type: "video",
      }),
    });
    render(<IncomingCallPrompt />);
    const prompt = screen.getByRole("alertdialog", {
      name: "Incoming video call from Alex Sato",
    });
    expect(prompt).toHaveTextContent("Incoming video call");
    expect(screen.getByRole("button", { name: "Answer" })).toBeInTheDocument();
  });

  it("warns that answering leaves the call already under way", () => {
    useCallsIs({
      incomingCall: call({ id: 40, status: "ringing", conversation: 20 }),
    });
    render(<IncomingCallPrompt />);
    expect(
      screen.getByRole("button", { name: "Leave & answer" }),
    ).toBeInTheDocument();
  });

  it("copes with a caller and a conversation it does not know", () => {
    useCallsIs({
      activeCall: null,
      incomingCall: call({
        status: "ringing",
        conversation: 999,
        created_by: null,
      }),
    });
    render(<IncomingCallPrompt />);
    expect(
      screen.getByRole("alertdialog", {
        name: "Incoming voice call from Someone",
      }),
    ).toBeInTheDocument();
  });

  it("names a group it knows only by its caller", () => {
    conversations = [{ id: 12, kind: "group", logoImage: null }];
    useCallsIs({ activeCall: null, incomingCall: call({ status: "ringing" }) });
    render(<IncomingCallPrompt />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Alex Sato started a voice call",
    );
  });
});

describe("ConversationCallButtons", () => {
  it("offers a voice and a video call to somebody who may start one", () => {
    const state = useCallsIs({ activeCall: null, phase: "idle" });
    render(<ConversationCallButtons conversationId={12} canStart />);
    click("Start a voice call");
    expect(state.startCall).toHaveBeenCalledWith(12, "audio");
    click("Start a video call");
    expect(state.startCall).toHaveBeenCalledWith(12, "video");
  });

  it("offers nothing to somebody who may not", () => {
    useCallsIs({ activeCall: null, phase: "idle" });
    const { container } = render(
      <ConversationCallButtons conversationId={12} canStart={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("waits while another call is starting", () => {
    useCallsIs({ activeCall: null, phase: "starting" });
    render(<ConversationCallButtons conversationId={12} canStart />);
    expect(
      screen.getByRole("button", { name: "Start a voice call" }),
    ).toBeDisabled();
  });

  it("offers the way back to the call you are in here", () => {
    const state = useCallsIs();
    render(<ConversationCallButtons conversationId="12" canStart />);
    click("Return to call");
    expect(state.setMinimized).toHaveBeenCalledWith(false);
  });

  it("offers to join a call already live here, saying how many are in it", () => {
    const live = call({ id: 50, call_type: "video" });
    const state = useCallsIs({
      activeCall: null,
      phase: "idle",
      liveCallsByConversation: { "12": live },
    });
    render(<ConversationCallButtons conversationId={12} canStart={false} />);
    const join = screen.getByRole("button", { name: /join call/i });
    expect(join).toHaveTextContent("(1)");
    expect(join).toHaveAttribute("title", "1 person in the call");
    fireEvent.click(join);
    expect(state.joinCall).toHaveBeenCalledWith(50);
  });

  it("counts several people, or nobody yet, in a live call", () => {
    const three = call({
      participants: [8, 9, 10].map((id) => ({
        id,
        user: { id, username: `u${id}` },
        left_at: null,
      })),
    });
    useCallsIs({
      activeCall: null,
      phase: "joining",
      liveCallsByConversation: { "12": three },
    });
    const first = render(
      <ConversationCallButtons conversationId={12} canStart />,
    );
    const join = screen.getByRole("button", { name: /join call/i });
    expect(join).toHaveAttribute("title", "3 people in the call");
    expect(join).toBeDisabled();
    first.unmount();

    useCallsIs({
      activeCall: null,
      phase: "idle",
      liveCallsByConversation: { "12": call({ participants: [] }) },
    });
    render(<ConversationCallButtons conversationId={12} canStart />);
    expect(screen.getByRole("button", { name: "Join call" })).toHaveAttribute(
      "title",
      "0 people in the call",
    );
  });
});

describe("ActiveCallView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-05T12:01:15Z"));
  });

  it("titles the call by its conversation and shows how long it has run", () => {
    render(<ActiveCallView />);
    const dialog = screen.getByRole("dialog", { name: "Call: Book club" });
    expect(
      within(dialog).getByRole("heading", { name: "Book club" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("1:15")).toBeInTheDocument();
    expect(within(dialog).getByText("Sam (you)")).toBeInTheDocument();
  });

  it.each([
    [{ phase: "starting" }, "Calling..."],
    [{ phase: "joining" }, "Connecting..."],
  ])("shows %j as %s", (overrides, status) => {
    useCallsIs(overrides);
    render(<ActiveCallView />);
    expect(screen.getAllByText(status).length).toBeGreaterThan(0);
  });

  it("says it is reconnecting", () => {
    useCallsIs({ media: media({ state: "reconnecting" }) });
    render(<ActiveCallView />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    expect(
      screen.getByText("Connection interrupted. Reconnecting..."),
    ).toBeInTheDocument();
  });

  it("says who it is waiting for while nobody else has joined", () => {
    useCallsIs({ activeCall: call({ status: "ringing" }) });
    const group = render(<ActiveCallView />);
    expect(
      screen.getByText("Waiting for others to join..."),
    ).toBeInTheDocument();
    group.unmount();

    useCallsIs({ activeCall: call({ status: "ringing", conversation: 20 }) });
    const direct = render(<ActiveCallView />);
    expect(screen.getByText("Ringing...")).toBeInTheDocument();
    direct.unmount();

    // Once somebody else is connected, it is simply a call.
    useCallsIs({
      activeCall: call({ status: "ringing" }),
      media: media({
        participants: [
          participant(),
          participant({ identity: "8", name: "Alex", isLocal: false }),
        ],
      }),
    });
    render(<ActiveCallView />);
    expect(
      screen.queryByText("Waiting for others to join..."),
    ).not.toBeInTheDocument();
  });

  it("says Connected for a call with no start time yet", () => {
    useCallsIs({ activeCall: call({ started_at: null }) });
    render(<ActiveCallView />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("titles a call that is still starting by the chat it is for", () => {
    useCallsIs({
      phase: "starting",
      activeCall: null,
      pendingStart: { conversationId: "20", type: "audio" },
      media: media({ participants: [], state: "connecting" }),
    });
    render(<ActiveCallView />);
    expect(
      screen.getByRole("dialog", { name: "Call: Alex Sato" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Calling...")).toHaveLength(2);
  });

  it("falls back to a plain title when it knows no conversation", () => {
    useCallsIs({ activeCall: null, phase: "joining" });
    render(<ActiveCallView />);
    expect(
      screen.getByRole("dialog", { name: "Call: Call" }),
    ).toBeInTheDocument();
  });

  it("says a recording is running, and can be minimised", () => {
    const state = useCallsIs({ activeCall: call({ is_recording: true }) });
    render(<ActiveCallView />);
    expect(screen.getByText("Recording")).toBeInTheDocument();
    click("Minimize call");
    expect(state.setMinimized).toHaveBeenCalledWith(true);
  });

  it("shows a device problem, and lets it be dismissed", () => {
    const state = useCallsIs({
      media: media({
        deviceError: {
          kind: "camera",
          permissionDenied: true,
          message: "Camera blocked.",
        },
      }),
    });
    render(<ActiveCallView />);
    expect(screen.getByText("Camera blocked.")).toBeInTheDocument();
    click("Dismiss");
    expect(state.media.clearDeviceError).toHaveBeenCalled();
  });

  it("offers to unblock audio the browser paused", () => {
    const state = useCallsIs({ media: media({ audioBlocked: true }) });
    render(<ActiveCallView />);
    click(/your browser paused the call audio/i);
    expect(state.media.startAudio).toHaveBeenCalled();
  });

  it("states outright that your screen is being shared, with the way to stop", () => {
    const sharing = participant({ screenTrack: track("screen") as never });
    const state = useCallsIs({
      media: media({
        isScreenSharing: true,
        participants: [
          sharing,
          participant({ identity: "8", name: "Alex", isLocal: false }),
        ],
      }),
    });
    render(<ActiveCallView />);
    expect(screen.getByText("You're sharing your screen")).toBeInTheDocument();
    expect(screen.getByText("Your screen")).toBeInTheDocument();
    // Everyone still gets a small tile beside the shared screen.
    expect(screen.getByText("Sam (you)")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Stop sharing" })[0]);
    expect(state.media.toggleScreenShare).toHaveBeenCalled();
  });

  it("explains under the controls why the screen cannot be shared", () => {
    useCallsIs({ media: media({ screenShareSupport: "not-in-plan" }) });
    const first = render(<ActiveCallView />);
    expect(
      screen.getByText(
        "Screen sharing isn't included in the plan for this call.",
      ),
    ).toBeInTheDocument();
    first.unmount();

    useCallsIs({ media: media({ screenShareSupport: "unsupported" }) });
    render(<ActiveCallView />);
    expect(
      screen.getByText(/This browser can't share a screen\./),
    ).toBeInTheDocument();
  });

  it.each([
    [1, "grid-cols-1"],
    [2, "sm:grid-cols-2"],
    [4, "grid-cols-2"],
    [6, "md:grid-cols-3"],
    [12, "md:grid-cols-4"],
  ])("lays %i people out in a grid that fits", (count, className) => {
    useCallsIs({
      media: media({
        participants: Array.from({ length: count }, (_, index) =>
          participant({
            identity: String(index + 7),
            name: `Person ${index}`,
            isLocal: index === 0,
          }),
        ),
      }),
    });
    const { container } = render(<ActiveCallView />);
    expect(container.querySelector(`.${CSS.escape(className)}`)).not.toBeNull();
  });

  it("uses the avatar of each person from the call's own list", () => {
    useCallsIs({
      media: media({
        participants: [
          participant({ identity: "8", name: "Alex", isLocal: false }),
        ],
      }),
    });
    const { container } = render(<ActiveCallView />);
    expect(
      container.querySelector('img[src="https://cdn.example/a.png"]'),
    ).not.toBeNull();
  });
});

describe("MinimizedCallBar", () => {
  it("keeps the call in reach: back to it, mute, and leave", () => {
    const state = useCallsIs({ activeCall: call({ is_recording: true }) });
    render(<MinimizedCallBar />);
    const bar = screen.getByRole("region", { name: "Call: Book club" });
    expect(within(bar).getByLabelText("Recording")).toBeInTheDocument();

    click("Mute");
    expect(state.media.toggleMicrophone).toHaveBeenCalled();
    click("Expand call");
    fireEvent.click(screen.getByTitle("Return to call"));
    expect(state.setMinimized).toHaveBeenCalledTimes(2);
    click("Leave call");
    expect(state.leaveCall).toHaveBeenCalled();
  });

  it("says when somebody is sharing a screen you cannot see from here", () => {
    useCallsIs({
      media: media({
        isMicrophoneEnabled: false,
        participants: [participant({ screenTrack: track() as never })],
      }),
    });
    render(<MinimizedCallBar />);
    expect(screen.getByText("Screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("ends a one-to-one for both sides", () => {
    const state = useCallsIs({
      activeCall: call({ conversation: 20 }),
      canAdministerActiveCall: true,
    });
    render(<MinimizedCallBar />);
    click("End call");
    expect(state.endCallForEveryone).toHaveBeenCalled();
  });
});

describe("CallLayer", () => {
  it("shows nothing when there is no call, prompt or message", () => {
    useCallsIs({ phase: "idle", activeCall: null });
    expect(render(<CallLayer />).container).toBeEmptyDOMElement();
  });

  it("shows the call full-screen, or as a bar when minimised", () => {
    const full = render(<CallLayer />);
    expect(
      screen.getByRole("dialog", { name: "Call: Book club" }),
    ).toBeInTheDocument();
    full.unmount();

    useCallsIs({ isMinimized: true });
    render(<CallLayer />);
    expect(
      screen.getByRole("region", { name: "Call: Book club" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the full view while a call is still starting, even if minimised", () => {
    useCallsIs({ phase: "starting", activeCall: null, isMinimized: true });
    render(<CallLayer />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("plays everybody else's audio, whichever view is showing", () => {
    const audio = [track("a1"), { ...track("a2"), sid: undefined }];
    useCallsIs({
      isMinimized: true,
      media: media({
        participants: [
          participant(),
          participant({
            identity: "8",
            name: "Alex",
            isLocal: false,
            audioTracks: audio as never,
          }),
        ],
      }),
    });
    const { container } = render(<CallLayer />);
    expect(container.querySelectorAll("audio")).toHaveLength(2);
    expect(audio[0].attach).toHaveBeenCalled();
  });

  it("shows the ring for an incoming call", () => {
    useCallsIs({
      phase: "idle",
      activeCall: null,
      incomingCall: call({ status: "ringing" }),
    });
    render(<CallLayer />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows a notice for a moment, then lets it go", () => {
    vi.useFakeTimers();
    const state = useCallsIs({
      phase: "ended",
      activeCall: null,
      notice: "Call ended.",
    });
    render(<CallLayer />);
    expect(screen.getByRole("status")).toHaveTextContent("Call ended.");
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(state.dismissNotice).toHaveBeenCalledTimes(1);

    click("Dismiss");
    expect(state.dismissNotice).toHaveBeenCalledTimes(2);
  });

  it("keeps an error up for longer, and shows it in place of a notice", () => {
    vi.useFakeTimers();
    const state = useCallsIs({
      phase: "idle",
      activeCall: null,
      notice: "Call ended.",
      error: "Lost connection to the call.",
    });
    const { unmount } = render(<CallLayer />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Lost connection to the call.",
    );
    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(state.dismissError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(state.dismissError).toHaveBeenCalledTimes(1);

    click("Dismiss");
    expect(state.dismissError).toHaveBeenCalledTimes(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
