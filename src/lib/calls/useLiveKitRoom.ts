"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionQuality,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type AudioTrack,
  type Participant,
  type VideoTrack,
} from "livekit-client";
import type { CallConnection } from "@/lib/calls/api";

/**
 * The one place the app talks to LiveKit.
 *
 * Everything LiveKit-shaped - the Room, its events, device publishing - stays
 * behind this hook. What comes out is a plain snapshot a component can render
 * and a handful of actions, so the rest of the call feature never subscribes
 * to a LiveKit event itself and the chat code never imports it at all.
 *
 * Media only. Who is in the call, whether it is ringing, who may end it: that
 * is Django's, and arrives over the app's socket, not here.
 */

export type MediaConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

/** Why the media connection closed, in the terms the call UI acts on. */
export type MediaDisconnectCause =
  | "left" // we asked for it
  | "ended" // the server closed the room: the call is over
  | "replaced" // this account connected from somewhere else
  | "lost"; // the network, after LiveKit's own reconnects gave up

export type CallMediaParticipant = {
  /** The LiveKit identity, which Django mints as the account id. */
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMicrophoneEnabled: boolean;
  /** Absent when the camera is off or muted. */
  cameraTrack?: VideoTrack;
  screenTrack?: VideoTrack;
  /** Remote only: a local track played back would be an echo. */
  audioTracks: AudioTrack[];
  poorConnection: boolean;
};

export type DeviceErrorKind = "microphone" | "camera" | "screen";

export type DeviceError = {
  kind: DeviceErrorKind;
  /** Blocked in the browser or OS, as opposed to missing or busy. */
  permissionDenied: boolean;
  message: string;
};

/**
 * LiveKit's protobuf TrackSource.SCREEN_SHARE. `canPublishSources` is the raw
 * protobuf list, and livekit-client does not re-export that enum.
 */
const PROTO_SOURCE_SCREEN_SHARE = 3;

function describeDeviceError(
  kind: DeviceErrorKind,
  error: unknown,
): DeviceError {
  const name = error instanceof Error ? error.name : "";
  const label =
    kind === "microphone"
      ? "microphone"
      : kind === "camera"
        ? "camera"
        : "screen";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      kind,
      permissionDenied: true,
      message: `Loopd'n isn't allowed to use your ${label}. Allow it in your browser's site settings, then try again.`,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      kind,
      permissionDenied: false,
      message: `No ${label} was found on this device.`,
    };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return {
      kind,
      permissionDenied: false,
      message: `Your ${label} is in use by another app.`,
    };
  }
  return {
    kind,
    permissionDenied: false,
    message: `Couldn't turn on your ${label}.`,
  };
}

function videoTrackFor(
  participant: Participant,
  source: Track.Source,
): VideoTrack | undefined {
  const publication = participant.getTrackPublication(source);
  if (!publication || publication.isMuted) return undefined;
  const track = publication.track;
  return track && track.kind === Track.Kind.Video
    ? (track as VideoTrack)
    : undefined;
}

function snapshotOf(room: Room): CallMediaParticipant[] {
  const describe = (
    participant: Participant,
    isLocal: boolean,
  ): CallMediaParticipant => ({
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal,
    isSpeaking: participant.isSpeaking,
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
    cameraTrack: videoTrackFor(participant, Track.Source.Camera),
    screenTrack: videoTrackFor(participant, Track.Source.ScreenShare),
    audioTracks: isLocal
      ? []
      : Array.from(participant.audioTrackPublications.values())
          .map((publication) => publication.track)
          .filter(
            (track): track is AudioTrack =>
              track !== undefined && track.kind === Track.Kind.Audio,
          ),
    poorConnection:
      participant.connectionQuality === ConnectionQuality.Poor ||
      participant.connectionQuality === ConnectionQuality.Lost,
  });

  return [
    describe(room.localParticipant, true),
    // Only people. The recorder joins as a participant too, with an identity
    // Django never minted - account ids are all digits.
    ...Array.from(room.remoteParticipants.values())
      .filter((participant) => /^\d+$/.test(participant.identity))
      .map((participant) => describe(participant, false)),
  ];
}

// Every event that can change what the snapshot says.
const SNAPSHOT_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ConnectionQualityChanged,
  RoomEvent.ParticipantNameChanged,
  RoomEvent.ParticipantPermissionsChanged,
] as const;

type UseLiveKitRoomOptions = {
  /** Called once per connection, when it closes for any reason. */
  onDisconnected?: (cause: MediaDisconnectCause) => void;
};

export function useLiveKitRoom({ onDisconnected }: UseLiveKitRoomOptions = {}) {
  const [state, setState] = useState<MediaConnectionState>("idle");
  const [participants, setParticipants] = useState<CallMediaParticipant[]>([]);
  const [deviceError, setDeviceError] = useState<DeviceError | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [canScreenShare, setCanScreenShare] = useState(false);

  // The live Room, for the actions. State is for rendering; a ref is what an
  // async action started before a re-render can still reach.
  const roomRef = useRef<Room | null>(null);
  const onDisconnectedRef = useRef(onDisconnected);
  useEffect(() => {
    onDisconnectedRef.current = onDisconnected;
  }, [onDisconnected]);

  const refresh = useCallback((target: Room) => {
    if (roomRef.current !== target) return;
    setParticipants(snapshotOf(target));

    const sources = target.localParticipant.permissions?.canPublishSources;
    // An empty list means "anything"; Django always sends an explicit one.
    setCanScreenShare(
      !sources ||
        sources.length === 0 ||
        sources.includes(PROTO_SOURCE_SCREEN_SHARE),
    );
  }, []);

  const connect = useCallback(
    async (
      connection: CallConnection,
      { camera }: { camera: boolean },
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      // One room at a time. A second connect replaces the first quietly.
      const previous = roomRef.current;
      if (previous) {
        roomRef.current = null;
        await previous.disconnect();
      }

      const next = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = next;
      setState("connecting");
      setDeviceError(null);
      setAudioBlocked(false);

      const update = () => refresh(next);
      SNAPSHOT_EVENTS.forEach((event) => next.on(event, update));

      next
        .on(RoomEvent.Reconnecting, () => {
          if (roomRef.current === next) setState("reconnecting");
        })
        .on(RoomEvent.Reconnected, () => {
          if (roomRef.current === next) setState("connected");
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (roomRef.current === next) setAudioBlocked(!next.canPlaybackAudio);
        })
        .on(
          RoomEvent.MediaDevicesError,
          (error: Error, kind?: MediaDeviceKind) => {
            if (roomRef.current !== next) return;
            setDeviceError(
              describeDeviceError(
                kind === "videoinput" ? "camera" : "microphone",
                error,
              ),
            );
          },
        )
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          // A room we already replaced or left says nothing to anybody.
          if (roomRef.current !== next) return;
          roomRef.current = null;
          setState("disconnected");
          setParticipants([]);

          const cause: MediaDisconnectCause =
            reason === DisconnectReason.CLIENT_INITIATED
              ? "left"
              : reason === DisconnectReason.ROOM_DELETED
                ? "ended"
                : reason === DisconnectReason.DUPLICATE_IDENTITY
                  ? "replaced"
                  : "lost";
          onDisconnectedRef.current?.(cause);
        });

      try {
        await next.connect(connection.url, connection.token);
      } catch (error) {
        // The reason is LiveKit's and technical; the person gets the plain one.
        console.error("[LiveKit] Connection failed:", error);
        const superseded = roomRef.current !== next;
        if (!superseded) {
          roomRef.current = null;
          setState("disconnected");
        }
        return {
          ok: false,
          message: superseded
            ? "Replaced by another call."
            : "Couldn't connect to the call. Check your connection and try again.",
        };
      }

      if (roomRef.current !== next) {
        return { ok: false, message: "Replaced by another call." };
      }
      setState("connected");
      setAudioBlocked(!next.canPlaybackAudio);
      refresh(next);

      // Devices AFTER the connection, each on its own. A blocked camera must
      // not stop somebody being heard, and neither must stop them hearing.
      try {
        await next.localParticipant.setMicrophoneEnabled(true);
      } catch (error) {
        setDeviceError(describeDeviceError("microphone", error));
      }
      if (camera) {
        try {
          await next.localParticipant.setCameraEnabled(true);
        } catch (error) {
          setDeviceError(describeDeviceError("camera", error));
        }
      }
      refresh(next);
      return { ok: true };
    },
    [refresh],
  );

  const disconnect = useCallback(async () => {
    const current = roomRef.current;
    if (!current) return;
    // Cleared first, so the Disconnected handler treats this as ours.
    roomRef.current = null;
    setState("disconnected");
    setParticipants([]);
    await current.disconnect();
    onDisconnectedRef.current?.("left");
  }, []);

  const toggle = useCallback(
    async (kind: DeviceErrorKind) => {
      const current = roomRef.current;
      if (!current) return;
      const local = current.localParticipant;
      setDeviceError(null);

      try {
        if (kind === "microphone") {
          await local.setMicrophoneEnabled(!local.isMicrophoneEnabled);
        } else if (kind === "camera") {
          await local.setCameraEnabled(!local.isCameraEnabled);
        } else {
          await local.setScreenShareEnabled(!local.isScreenShareEnabled, {
            audio: true,
          });
        }
      } catch (error) {
        // Closing the screen picker is a NotAllowedError too, and is a choice,
        // not a failure. There is no way to tell it from a real denial, so the
        // screen share says nothing either way.
        const cancelled =
          kind === "screen" &&
          error instanceof Error &&
          error.name === "NotAllowedError";
        if (!cancelled) setDeviceError(describeDeviceError(kind, error));
      }
      refresh(current);
    },
    [refresh],
  );

  const toggleMicrophone = useCallback(() => toggle("microphone"), [toggle]);
  const toggleCamera = useCallback(() => toggle("camera"), [toggle]);
  const toggleScreenShare = useCallback(() => toggle("screen"), [toggle]);

  /** Browsers refuse to play audio without a gesture; this is the gesture. */
  const startAudio = useCallback(async () => {
    const current = roomRef.current;
    if (!current) return;
    await current.startAudio();
    setAudioBlocked(!current.canPlaybackAudio);
  }, []);

  const clearDeviceError = useCallback(() => setDeviceError(null), []);

  // Unmounting mid-call must not leave the camera light on.
  useEffect(() => {
    return () => {
      const current = roomRef.current;
      roomRef.current = null;
      void current?.disconnect();
    };
  }, []);

  const local = participants.find((participant) => participant.isLocal);
  const isMicrophoneEnabled = local?.isMicrophoneEnabled ?? false;
  const isCameraEnabled = Boolean(local?.cameraTrack);
  const isScreenSharing = Boolean(local?.screenTrack);

  return useMemo(
    () => ({
      state,
      participants,
      deviceError,
      clearDeviceError,
      audioBlocked,
      startAudio,
      canScreenShare,
      isMicrophoneEnabled,
      isCameraEnabled,
      isScreenSharing,
      connect,
      disconnect,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
    }),
    [
      state,
      participants,
      deviceError,
      clearDeviceError,
      audioBlocked,
      startAudio,
      canScreenShare,
      isMicrophoneEnabled,
      isCameraEnabled,
      isScreenSharing,
      connect,
      disconnect,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
    ],
  );
}
