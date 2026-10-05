import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A room the test drives by hand. `vi.hoisted` because the mock factory below
// runs before any import in this file.
const livekit = vi.hoisted(() => {
  const RoomEvent = {
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
    TrackMuted: "trackMuted",
    TrackUnmuted: "trackUnmuted",
    LocalTrackPublished: "localTrackPublished",
    LocalTrackUnpublished: "localTrackUnpublished",
    ActiveSpeakersChanged: "activeSpeakersChanged",
    ConnectionQualityChanged: "connectionQualityChanged",
    ParticipantNameChanged: "participantNameChanged",
    ParticipantPermissionsChanged: "participantPermissionsChanged",
    Reconnecting: "reconnecting",
    Reconnected: "reconnected",
    AudioPlaybackStatusChanged: "audioPlaybackStatusChanged",
    MediaDevicesError: "mediaDevicesError",
    Disconnected: "disconnected",
  };
  const Track = {
    Source: {
      Camera: "camera",
      ScreenShare: "screen_share",
      Microphone: "microphone",
    },
    Kind: { Video: "video", Audio: "audio" },
  };
  const ConnectionQuality = {
    Excellent: "excellent",
    Poor: "poor",
    Lost: "lost",
  };
  const DisconnectReason = {
    CLIENT_INITIATED: 1,
    DUPLICATE_IDENTITY: 2,
    ROOM_DELETED: 5,
    SIGNAL_CLOSE: 9,
  };

  type Publication = { isMuted: boolean; track?: { kind: string } };

  class FakeParticipant {
    name = "";
    isSpeaking = false;
    isMicrophoneEnabled = false;
    isCameraEnabled = false;
    isScreenShareEnabled = false;
    connectionQuality = ConnectionQuality.Excellent;
    permissions: { canPublishSources?: number[] } | undefined = undefined;
    publications = new Map<string, Publication>();
    audioTrackPublications = new Map<string, Publication>();
    failures: Record<string, unknown> = {};

    constructor(public identity: string) {}

    getTrackPublication(source: string) {
      return this.publications.get(source);
    }

    setMicrophoneEnabled = vi.fn(async (on: boolean) => {
      if (this.failures.microphone) throw this.failures.microphone;
      this.isMicrophoneEnabled = on;
    });

    setCameraEnabled = vi.fn(async (on: boolean) => {
      if (this.failures.camera) throw this.failures.camera;
      this.isCameraEnabled = on;
      if (on) {
        this.publications.set(Track.Source.Camera, {
          isMuted: false,
          track: { kind: Track.Kind.Video },
        });
      } else {
        this.publications.delete(Track.Source.Camera);
      }
    });

    setScreenShareEnabled = vi.fn(async (on: boolean) => {
      if (this.failures.screen) throw this.failures.screen;
      this.isScreenShareEnabled = on;
      if (on) {
        this.publications.set(Track.Source.ScreenShare, {
          isMuted: false,
          track: { kind: Track.Kind.Video },
        });
      } else {
        this.publications.delete(Track.Source.ScreenShare);
      }
    });
  }

  class FakeRoom {
    static instances: FakeRoom[] = [];
    static connectFailure: unknown = null;
    static pendingConnect: Promise<void> | null = null;

    localParticipant = new FakeParticipant("7");
    remoteParticipants = new Map<string, FakeParticipant>();
    canPlaybackAudio = true;
    listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    connect = vi.fn(async () => {
      if (FakeRoom.pendingConnect) await FakeRoom.pendingConnect;
      if (FakeRoom.connectFailure) throw FakeRoom.connectFailure;
    });
    disconnect = vi.fn(async () => {});
    startAudio = vi.fn(async () => {
      this.canPlaybackAudio = true;
    });

    constructor(public options: unknown) {
      FakeRoom.instances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      this.listeners.set(event, [
        ...(this.listeners.get(event) ?? []),
        listener,
      ]);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }
  }

  return {
    RoomEvent,
    Track,
    ConnectionQuality,
    DisconnectReason,
    FakeRoom,
    FakeParticipant,
  };
});

vi.mock("livekit-client", () => ({
  ConnectionQuality: livekit.ConnectionQuality,
  DisconnectReason: livekit.DisconnectReason,
  Room: livekit.FakeRoom,
  RoomEvent: livekit.RoomEvent,
  Track: livekit.Track,
}));

import { useLiveKitRoom } from "@/lib/calls/useLiveKitRoom";

const {
  FakeRoom,
  FakeParticipant,
  RoomEvent,
  Track,
  ConnectionQuality,
  DisconnectReason,
} = livekit;

const CONNECTION = {
  url: "wss://livekit.example",
  token: "jwt",
  expiresAt: "",
};

function room(index = -1) {
  return FakeRoom.instances.at(index)!;
}

function named(name: string) {
  return Object.assign(new Error("failed"), { name });
}

async function connected(camera = false, onDisconnected = vi.fn()) {
  const view = renderHook(() => useLiveKitRoom({ onDisconnected }));
  let outcome: unknown;
  await act(async () => {
    outcome = await view.result.current.connect(CONNECTION, { camera });
  });
  return { ...view, outcome, onDisconnected };
}

beforeEach(() => {
  FakeRoom.instances = [];
  FakeRoom.connectFailure = null;
  FakeRoom.pendingConnect = null;
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: () => {} } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLiveKitRoom - connecting", () => {
  it("is idle, with nobody in it, until asked to connect", () => {
    const { result } = renderHook(() => useLiveKitRoom());
    expect(result.current).toMatchObject({
      state: "idle",
      participants: [],
      deviceError: null,
      audioBlocked: false,
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenSharing: false,
    });
    expect(FakeRoom.instances).toHaveLength(0);
  });

  it("joins with the microphone on, and the camera off for an audio call", async () => {
    const { result, outcome } = await connected(false);
    expect(outcome).toEqual({ ok: true });
    expect(room().connect).toHaveBeenCalledWith("wss://livekit.example", "jwt");
    expect(room().options).toEqual({ adaptiveStream: true, dynacast: true });
    expect(room().localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(result.current.state).toBe("connected");
    expect(result.current.isMicrophoneEnabled).toBe(true);
    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.participants).toEqual([
      expect.objectContaining({
        identity: "7",
        name: "7",
        isLocal: true,
        audioTracks: [],
      }),
    ]);
  });

  it("joins a video call with the camera on", async () => {
    const { result } = await connected(true);
    expect(result.current.isCameraEnabled).toBe(true);
    expect(result.current.participants[0].cameraTrack).toBeTruthy();
  });

  it("stays in the call when a device will not start, and says which", async () => {
    const view = renderHook(() => useLiveKitRoom());
    await act(async () => {
      // The room is made inside connect, so the failure is arranged once it
      // exists and before the devices are asked for.
      const pending = view.result.current.connect(CONNECTION, { camera: true });
      room().localParticipant.failures.camera = named("NotFoundError");
      await pending;
    });
    expect(view.result.current.state).toBe("connected");
    expect(view.result.current.deviceError).toEqual({
      kind: "camera",
      permissionDenied: false,
      message: "No camera was found on this device.",
    });
  });

  it("reports a microphone it is not allowed to use", async () => {
    const view = renderHook(() => useLiveKitRoom());
    await act(async () => {
      const pending = view.result.current.connect(CONNECTION, {
        camera: false,
      });
      room().localParticipant.failures.microphone = named("NotAllowedError");
      await pending;
    });
    expect(view.result.current.deviceError).toMatchObject({
      kind: "microphone",
      permissionDenied: true,
    });
    expect(view.result.current.deviceError?.message).toMatch(
      /isn't allowed to use your microphone/,
    );

    act(() => view.result.current.clearDeviceError());
    expect(view.result.current.deviceError).toBeNull();
  });

  it("fails cleanly when the room cannot be reached", async () => {
    FakeRoom.connectFailure = new Error("timeout");
    const { result, outcome } = await connected();
    expect(outcome).toEqual({
      ok: false,
      message:
        "Couldn't connect to the call. Check your connection and try again.",
    });
    expect(result.current.state).toBe("disconnected");
  });

  it("leaves the previous room when asked to connect again", async () => {
    const { result } = await connected();
    const first = room();
    await act(async () => {
      await result.current.connect(CONNECTION, { camera: false });
    });
    expect(first.disconnect).toHaveBeenCalled();
    expect(FakeRoom.instances).toHaveLength(2);

    // Late events from the room that was left change nothing.
    act(() => first.emit(RoomEvent.Reconnecting));
    act(() =>
      first.emit(RoomEvent.Disconnected, DisconnectReason.SIGNAL_CLOSE),
    );
    expect(result.current.state).toBe("connected");
  });

  it("gives way when a second connect overtakes a slow first one", async () => {
    let release!: () => void;
    FakeRoom.pendingConnect = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { result } = renderHook(() => useLiveKitRoom());
    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.connect(CONNECTION, { camera: false });
      await Promise.resolve();
    });
    FakeRoom.pendingConnect = null;
    await act(async () => {
      await result.current.connect(CONNECTION, { camera: false });
    });
    await act(async () => {
      release();
    });
    await expect(first).resolves.toEqual({
      ok: false,
      message: "Replaced by another call.",
    });
    expect(result.current.state).toBe("connected");
  });

  it("says it was replaced when a superseded connect also fails", async () => {
    let fail!: (reason: unknown) => void;
    FakeRoom.pendingConnect = new Promise<void>((_, reject) => {
      fail = reject;
    });
    const { result } = renderHook(() => useLiveKitRoom());
    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.connect(CONNECTION, { camera: false });
      await Promise.resolve();
    });
    FakeRoom.pendingConnect = null;
    await act(async () => {
      await result.current.connect(CONNECTION, { camera: false });
    });
    await act(async () => {
      fail(new Error("aborted"));
    });
    await expect(first).resolves.toEqual({
      ok: false,
      message: "Replaced by another call.",
    });
    expect(result.current.state).toBe("connected");
  });
});

describe("useLiveKitRoom - participants", () => {
  it("lists the people in the call, and skips the recorder and other services", async () => {
    const { result } = await connected();
    const alex = new FakeParticipant("8");
    alex.name = "Alex";
    alex.isSpeaking = true;
    alex.isMicrophoneEnabled = true;
    alex.connectionQuality = ConnectionQuality.Poor;
    alex.publications.set(Track.Source.Camera, {
      isMuted: false,
      track: { kind: Track.Kind.Video },
    });
    alex.publications.set(Track.Source.ScreenShare, {
      isMuted: true,
      track: { kind: "video" },
    });
    alex.audioTrackPublications.set("a", {
      isMuted: false,
      track: { kind: Track.Kind.Audio },
    });
    alex.audioTrackPublications.set("b", { isMuted: false });
    alex.audioTrackPublications.set("c", {
      isMuted: false,
      track: { kind: "data" },
    });
    const recorder = new FakeParticipant("EG_abc123");
    room().remoteParticipants.set("8", alex);
    room().remoteParticipants.set("EG_abc123", recorder);

    act(() => room().emit(RoomEvent.ParticipantConnected));
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[1]).toMatchObject({
      identity: "8",
      name: "Alex",
      isLocal: false,
      isSpeaking: true,
      isMicrophoneEnabled: true,
      poorConnection: true,
      screenTrack: undefined,
    });
    expect(result.current.participants[1].cameraTrack).toBeTruthy();
    expect(result.current.participants[1].audioTracks).toHaveLength(1);
  });

  it("ignores a camera publication that is not a video track, or has none yet", async () => {
    const { result } = await connected();
    room().localParticipant.publications.set(Track.Source.Camera, {
      isMuted: false,
      track: { kind: Track.Kind.Audio },
    });
    act(() => room().emit(RoomEvent.TrackSubscribed));
    expect(result.current.isCameraEnabled).toBe(false);

    room().localParticipant.publications.set(Track.Source.Camera, {
      isMuted: false,
    });
    room().localParticipant.connectionQuality = ConnectionQuality.Lost;
    act(() => room().emit(RoomEvent.TrackSubscribed));
    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.participants[0].poorConnection).toBe(true);
  });
});

describe("useLiveKitRoom - devices", () => {
  it("toggles the microphone and the camera", async () => {
    const { result } = await connected();
    await act(() => result.current.toggleMicrophone());
    expect(result.current.isMicrophoneEnabled).toBe(false);
    await act(() => result.current.toggleMicrophone());
    expect(result.current.isMicrophoneEnabled).toBe(true);

    await act(() => result.current.toggleCamera());
    expect(result.current.isCameraEnabled).toBe(true);
    await act(() => result.current.toggleCamera());
    expect(result.current.isCameraEnabled).toBe(false);
  });

  it("shares the screen with its audio, and stops again", async () => {
    const { result } = await connected();
    await act(() => result.current.toggleScreenShare());
    expect(room().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(
      true,
      {
        audio: true,
      },
    );
    expect(result.current.isScreenSharing).toBe(true);
    await act(() => result.current.toggleScreenShare());
    expect(result.current.isScreenSharing).toBe(false);
  });

  it("treats a dismissed screen picker as a change of mind, not an error", async () => {
    const { result } = await connected();
    room().localParticipant.failures.screen = named("NotAllowedError");
    await act(() => result.current.toggleScreenShare());
    expect(result.current.deviceError).toBeNull();

    room().localParticipant.failures.screen = named("NotReadableError");
    await act(() => result.current.toggleScreenShare());
    expect(result.current.deviceError).toEqual({
      kind: "screen",
      permissionDenied: false,
      message: "Your screen is in use by another app.",
    });
  });

  it.each([
    ["SecurityError", true, /isn't allowed to use your camera/],
    ["OverconstrainedError", false, /No camera was found/],
    ["AbortError", false, /in use by another app/],
    ["SomethingElse", false, /Couldn't turn on your camera\./],
  ])("explains a camera failing with %s", async (name, denied, message) => {
    const { result } = await connected();
    room().localParticipant.failures.camera = named(name);
    await act(() => result.current.toggleCamera());
    expect(result.current.deviceError).toMatchObject({
      kind: "camera",
      permissionDenied: denied,
    });
    expect(result.current.deviceError?.message).toMatch(message);
  });

  it("explains a failure that is not an Error at all", async () => {
    const { result } = await connected();
    room().localParticipant.failures.microphone = "nope";
    await act(() => result.current.toggleMicrophone());
    expect(result.current.deviceError?.message).toBe(
      "Couldn't turn on your microphone.",
    );
  });

  it("does nothing with no room to act on", async () => {
    const { result } = renderHook(() => useLiveKitRoom());
    await act(async () => {
      await result.current.toggleMicrophone();
      await result.current.startAudio();
      await result.current.disconnect();
    });
    expect(result.current.state).toBe("idle");
  });

  it("names the device a room-level error came from", async () => {
    const { result } = await connected();
    act(() =>
      room().emit(
        RoomEvent.MediaDevicesError,
        named("NotFoundError"),
        "videoinput",
      ),
    );
    expect(result.current.deviceError?.kind).toBe("camera");
    act(() =>
      room().emit(
        RoomEvent.MediaDevicesError,
        named("NotFoundError"),
        "audioinput",
      ),
    );
    expect(result.current.deviceError?.kind).toBe("microphone");
  });
});

describe("useLiveKitRoom - screen sharing support", () => {
  it("is ready when the grant does not restrict what may be published", async () => {
    const { result } = await connected();
    expect(result.current.screenShareSupport).toBe("ready");

    room().localParticipant.permissions = { canPublishSources: [] };
    act(() => room().emit(RoomEvent.ParticipantPermissionsChanged));
    expect(result.current.screenShareSupport).toBe("ready");

    room().localParticipant.permissions = { canPublishSources: [1, 3] };
    act(() => room().emit(RoomEvent.ParticipantPermissionsChanged));
    expect(result.current.screenShareSupport).toBe("ready");
  });

  it("is not in the plan when the grant leaves screen sharing out", async () => {
    const { result } = await connected();
    room().localParticipant.permissions = { canPublishSources: [1, 2] };
    act(() => room().emit(RoomEvent.ParticipantPermissionsChanged));
    expect(result.current.screenShareSupport).toBe("not-in-plan");
  });

  it("is unsupported where the browser cannot capture a screen", async () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    const { result } = await connected();
    expect(result.current.screenShareSupport).toBe("unsupported");
  });
});

describe("useLiveKitRoom - audio playback", () => {
  it("says when the browser is blocking audio, and unblocks on a click", async () => {
    const { result } = await connected();
    expect(result.current.audioBlocked).toBe(false);

    room().canPlaybackAudio = false;
    act(() => room().emit(RoomEvent.AudioPlaybackStatusChanged));
    expect(result.current.audioBlocked).toBe(true);

    await act(() => result.current.startAudio());
    expect(room().startAudio).toHaveBeenCalled();
    expect(result.current.audioBlocked).toBe(false);
  });
});

describe("useLiveKitRoom - losing the connection", () => {
  it("shows a reconnect in progress, and when it succeeds", async () => {
    const { result } = await connected();
    act(() => room().emit(RoomEvent.Reconnecting));
    expect(result.current.state).toBe("reconnecting");
    act(() => room().emit(RoomEvent.Reconnected));
    expect(result.current.state).toBe("connected");
  });

  it.each([
    [DisconnectReason.CLIENT_INITIATED, "left"],
    [DisconnectReason.ROOM_DELETED, "ended"],
    [DisconnectReason.DUPLICATE_IDENTITY, "replaced"],
    [DisconnectReason.SIGNAL_CLOSE, "lost"],
    [undefined, "lost"],
  ])("reports a disconnect for reason %s as %s", async (reason, cause) => {
    const { result, onDisconnected } = await connected();
    act(() => room().emit(RoomEvent.Disconnected, reason));
    expect(result.current.state).toBe("disconnected");
    expect(result.current.participants).toEqual([]);
    expect(onDisconnected).toHaveBeenCalledWith(cause);
  });

  it("leaves on request, reporting it once", async () => {
    const { result, onDisconnected } = await connected();
    const current = room();
    await act(() => result.current.disconnect());
    expect(current.disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("disconnected");
    expect(onDisconnected).toHaveBeenCalledWith("left");

    // The room's own Disconnected event, arriving late, is not reported again.
    act(() =>
      current.emit(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED),
    );
    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  it("leaves the room when the screen that started it goes away", async () => {
    const { unmount } = await connected();
    const current = room();
    unmount();
    expect(current.disconnect).toHaveBeenCalled();
  });

  it("calls whichever handler is current", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook(
      ({ handler }) => useLiveKitRoom({ onDisconnected: handler }),
      {
        initialProps: { handler: first },
      },
    );
    await act(async () => {
      await view.result.current.connect(CONNECTION, { camera: false });
    });
    view.rerender({ handler: second });
    act(() =>
      room().emit(RoomEvent.Disconnected, DisconnectReason.ROOM_DELETED),
    );
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("ended");
  });
});
