"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppShell } from "@/lib/app/AppShellProvider";
import type { Conversation } from "@/lib/chat/conversations";
import {
  currentStays,
  endCall as requestEndCall,
  fetchCalls,
  isCallLive,
  joinCall as requestJoinCall,
  leaveCall as requestLeaveCall,
  rejectCall as requestRejectCall,
  startCall as requestStartCall,
  startRecording as requestStartRecording,
  stopRecording as requestStopRecording,
  type Call,
  type CallConnection,
  type CallType,
} from "@/lib/calls/api";
import { parseCallEvent } from "@/lib/calls/events";
import {
  useLiveKitRoom,
  type MediaDisconnectCause,
} from "@/lib/calls/useLiveKitRoom";

/**
 * Where this device is with calls.
 *
 *   idle        in no call
 *   starting    asked Django to start one
 *   joining     asked Django for a token, or connecting to LiveKit with it
 *   in-call     connected (LiveKit may be reconnecting underneath - see media)
 *   ended       the call just finished; `notice` says how
 */
export type CallPhase = "idle" | "starting" | "joining" | "in-call" | "ended";

/**
 * How long an incoming call rings on screen. A one-to-one call is ended by the
 * server after CALL_RING_TIMEOUT_SECONDS (90); a group call never stops
 * "ringing" server-side while anybody is in it, so the prompt has to give up
 * on its own - the header's Join button is still there afterwards.
 */
const INCOMING_RING_MS = 60_000;

/** Rejoin attempts after LiveKit's own reconnects have given up. */
const MAX_REJOIN_ATTEMPTS = 2;

function endedMessage(call: Call): string {
  switch (call.endReason) {
    case "declined":
      return "Call declined.";
    case "unanswered":
      return "No answer.";
    case "timed_out":
      return "The call reached its time limit.";
    default:
      return "Call ended.";
  }
}

function findConversation(
  conversations: Conversation[],
  conversationId: string | number,
): Conversation | undefined {
  return conversations.find(
    (conversation) => String(conversation.id) === String(conversationId),
  );
}

type CallContextType = {
  phase: CallPhase;
  /** The call this device is in, or joining. */
  activeCall: Call | null;
  /** What is being started, before Django has answered with a call. */
  pendingStart: { conversationId: string | number; type: CallType } | null;
  /** Somebody is calling. */
  incomingCall: Call | null;
  /** Live calls this device has heard about, by conversation id. */
  liveCallsByConversation: Record<string, Call>;
  /** Shown after a call ends: "Call declined.", "No answer."... */
  notice: string | null;
  error: string | null;
  isMinimized: boolean;
  isRecordingBusy: boolean;
  /** Whether this account may end the active call for all, or record it. */
  canAdministerActiveCall: boolean;
  media: ReturnType<typeof useLiveKitRoom>;

  startCall: (conversationId: string | number, type: CallType) => Promise<void>;
  joinCall: (callId: number) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => void;
  leaveCall: () => Promise<void>;
  endCallForEveryone: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  rejoinActiveCall: () => Promise<void>;
  setMinimized: (minimized: boolean) => void;
  dismissNotice: () => void;
  dismissError: () => void;
  conversationFor: (call: Call) => Conversation | undefined;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

/**
 * Calls, for every signed-in route.
 *
 * Sits under AppShellProvider and uses ITS socket: the `call.*` frames arrive
 * on the one connection the app already holds, so there is no second socket
 * and no call logic in the chat code. Django is asked for everything that is
 * a decision (start, join, leave, end, record); LiveKit only carries media,
 * through useLiveKitRoom.
 *
 * Above the routes so a call survives navigating between them.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { subscribeToSocket, conversations, userProfile } = useAppShell();

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [activeCall, setActiveCallState] = useState<Call | null>(null);
  const [pendingStart, setPendingStart] =
    useState<CallContextType["pendingStart"]>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [liveCallsByConversation, setLiveCallsByConversation] = useState<
    Record<string, Call>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setMinimized] = useState(false);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);

  // Read by socket and LiveKit callbacks that outlive the render they were
  // made in. The state above is for drawing; these are for deciding.
  const activeCallRef = useRef<Call | null>(null);
  const conversationsRef = useRef(conversations);
  const usernameRef = useRef(userProfile.username);
  const rejoinAttempts = useRef(0);
  const rejoinRef = useRef<(call: Call) => Promise<void>>(async () => {});

  useEffect(() => {
    conversationsRef.current = conversations;
    usernameRef.current = userProfile.username;
  }, [conversations, userProfile.username]);

  const setActiveCall = useCallback((call: Call | null) => {
    activeCallRef.current = call;
    setActiveCallState(call);
  }, []);

  /** The account id of this user, as the socket's `user_id` spells it. */
  const myUserIdIn = useCallback((conversationId: number) => {
    const username = usernameRef.current;
    if (!username) return undefined;
    return findConversation(
      conversationsRef.current,
      conversationId,
    )?.participants.find((participant) => participant.username === username)
      ?.userId;
  }, []);

  const finish = useCallback(
    (message: string | null) => {
      setActiveCall(null);
      setPendingStart(null);
      setMinimized(false);
      rejoinAttempts.current = 0;
      if (message) {
        setNotice(message);
        setPhase("ended");
      } else {
        setNotice(null);
        setPhase("idle");
      }
    },
    [setActiveCall],
  );

  const handleMediaDisconnected = useCallback(
    (cause: MediaDisconnectCause) => {
      const call = activeCallRef.current;
      // "left" is always ours, and whoever left has already tidied up.
      if (!call || cause === "left") return;

      if (cause === "ended") {
        finish("Call ended.");
      } else if (cause === "replaced") {
        // Not a leave: the account is still in the call, on the other device.
        finish("You joined this call from another device.");
      } else {
        void rejoinRef.current(call);
      }
    },
    [finish],
  );

  const media = useLiveKitRoom({ onDisconnected: handleMediaDisconnected });
  const { connect: connectMedia, disconnect: disconnectMedia } = media;

  /** Take a token Django issued and connect to LiveKit with it. */
  const connectTo = useCallback(
    async (call: Call, connection: CallConnection) => {
      setActiveCall(call);
      setPendingStart(null);
      setPhase("joining");

      const result = await connectMedia(connection, {
        camera: call.type === "video",
      });
      // Somebody left, or picked up a different call, while this connected.
      if (activeCallRef.current?.id !== call.id) {
        // Nobody is holding this connection any more; do not leave it open.
        if (result.ok && !activeCallRef.current) void disconnectMedia();
        return;
      }

      if (result.ok) {
        rejoinAttempts.current = 0;
        setPhase("in-call");
        return;
      }

      // Django holds a place for this stay until told otherwise; a connection
      // that never happened must give it back, or it counts against the cap.
      void requestLeaveCall(call.id);
      setActiveCall(null);
      setPhase("idle");
      setError(result.message);
    },
    [connectMedia, disconnectMedia, setActiveCall],
  );

  const joinCall = useCallback(
    async (callId: number) => {
      const current = activeCallRef.current;
      if (current?.id === callId) {
        setMinimized(false);
        return;
      }
      if (current) {
        const previous = current;
        setActiveCall(null);
        await disconnectMedia();
        void requestLeaveCall(previous.id);
      }

      setError(null);
      setNotice(null);
      setMinimized(false);
      setPhase("joining");

      const result = await requestJoinCall(callId);
      if (!result.ok) {
        setPhase("idle");
        setError(result.message);
        return;
      }
      await connectTo(result.call, result.connection);
    },
    [connectTo, disconnectMedia, setActiveCall],
  );

  const startCall = useCallback(
    async (conversationId: string | number, type: CallType) => {
      const current = activeCallRef.current;
      if (
        current &&
        String(current.conversationId) === String(conversationId)
      ) {
        setMinimized(false);
        return;
      }
      if (phase === "starting" || phase === "joining") return;
      if (current) {
        setActiveCall(null);
        await disconnectMedia();
        void requestLeaveCall(current.id);
      }

      setError(null);
      setNotice(null);
      setMinimized(false);
      setPendingStart({ conversationId, type });
      setPhase("starting");

      const result = await requestStartCall(conversationId, type);
      if (!result.ok) {
        setPendingStart(null);
        // One live call per conversation: pressing Call joins the one going.
        if ("existingCallId" in result && result.existingCallId) {
          await joinCall(result.existingCallId);
          return;
        }
        setPhase("idle");
        setError(result.message);
        return;
      }
      await connectTo(result.call, result.connection);
    },
    [connectTo, disconnectMedia, joinCall, phase, setActiveCall],
  );

  const rejoin = useCallback(
    async (call: Call) => {
      if (rejoinAttempts.current >= MAX_REJOIN_ATTEMPTS) {
        setActiveCall(null);
        setPhase("idle");
        setError("Lost connection to the call.");
        void requestLeaveCall(call.id);
        return;
      }
      rejoinAttempts.current += 1;
      setPhase("joining");

      // A fresh token: the old one was spent when LiveKit first accepted it.
      const result = await requestJoinCall(call.id);
      if (activeCallRef.current?.id !== call.id) return;
      if (!result.ok) {
        // 409 is "this call has ended" - it finished while we were away.
        finish(result.status === 409 ? "Call ended." : null);
        if (result.status !== 409) setError(result.message);
        return;
      }
      await connectTo(result.call, result.connection);
    },
    [connectTo, finish, setActiveCall],
  );

  useEffect(() => {
    rejoinRef.current = rejoin;
  }, [rejoin]);

  const rejoinActiveCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    rejoinAttempts.current = 0;
    await rejoin(call);
  }, [rejoin]);

  const leaveCall = useCallback(async () => {
    const call = activeCallRef.current;
    finish(null);
    await disconnectMedia();
    if (call) {
      const result = await requestLeaveCall(call.id);
      if (!result.ok) setError(result.message);
    }
  }, [disconnectMedia, finish]);

  const endCallForEveryone = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    const result = await requestEndCall(call.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    finish(null);
    await disconnectMedia();
  }, [disconnectMedia, finish]);

  const acceptIncomingCall = useCallback(async () => {
    const call = incomingCall;
    if (!call) return;
    setIncomingCall(null);
    await joinCall(call.id);
  }, [incomingCall, joinCall]);

  const declineIncomingCall = useCallback(() => {
    const call = incomingCall;
    if (!call) return;
    setIncomingCall(null);
    void requestRejectCall(call.id).then((result) => {
      // Too late to decline is not worth a message: it has ended, or we are in.
      if (!result.ok && result.status !== 400 && result.status !== 409) {
        setError(result.message);
      }
    });
  }, [incomingCall]);

  const toggleRecording = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    setIsRecordingBusy(true);
    const result = call.isRecording
      ? await requestStopRecording(call.id)
      : await requestStartRecording(call.id);
    setIsRecordingBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    // The socket frame follows with the whole call; this is only so the
    // button does not lag behind the click.
    const current = activeCallRef.current;
    if (current?.id === call.id) {
      setActiveCall({
        ...current,
        isRecording:
          result.recording.status === "recording" ||
          result.recording.status === "starting",
      });
    }
  }, [setActiveCall]);

  // -- the socket --------------------------------------------------------

  useEffect(
    () =>
      subscribeToSocket((message) => {
        const event = parseCallEvent(message);
        if (!event) return;
        const { call } = event;

        setLiveCallsByConversation((current) => {
          const key = String(call.conversationId);
          if (isCallLive(call)) return { ...current, [key]: call };
          if (!(key in current)) return current;
          const next = { ...current };
          delete next[key];
          return next;
        });

        const active = activeCallRef.current;
        if (active?.id === call.id) {
          if (event.type === "call.ended") {
            finish(endedMessage(call));
            void disconnectMedia();
          } else {
            setActiveCall(call);
          }
        }

        const me = myUserIdIn(call.conversationId);
        setIncomingCall((current) => {
          if (event.type === "call.incoming") {
            return active?.id === call.id ? current : call;
          }
          if (!current || current.id !== call.id) return current;
          if (!isCallLive(call)) return null;
          // Answered or declined on another of this account's devices.
          if (me && event.userId === me) return null;
          return call;
        });
      }),
    [disconnectMedia, finish, myUserIdIn, setActiveCall, subscribeToSocket],
  );

  // What was already going before this page loaded. The socket only reports
  // changes, so without this a call started a minute ago has no Join button
  // and somebody opening the app mid-ring is never rung.
  //
  // Waits for the username: until the profile has loaded there is no telling
  // somebody else's ringing call from this account's own.
  const username = userProfile.username;
  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    Promise.all([
      fetchCalls({ status: "ringing" }),
      fetchCalls({ status: "active" }),
    ]).then((results) => {
      if (cancelled) return;
      const live = results.flatMap((result) => (result.ok ? result.calls : []));
      if (live.length === 0) return;

      setLiveCallsByConversation((current) => {
        const next = { ...current };
        for (const call of live) {
          // A frame that arrived while this was in flight is newer.
          next[String(call.conversationId)] ??= call;
        }
        return next;
      });

      const ringingForMe = live.find(
        (call) =>
          call.status === "ringing" &&
          Date.now() - Date.parse(call.createdAt) < INCOMING_RING_MS &&
          call.createdBy?.username !== username &&
          !currentStays(call).some((stay) => stay.user.username === username),
      );
      if (ringingForMe) {
        setIncomingCall((current) => current ?? ringingForMe);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [username]);

  // Stop ringing after a while. See INCOMING_RING_MS.
  useEffect(() => {
    if (!incomingCall) return;
    const id = incomingCall.id;
    const timer = window.setTimeout(() => {
      setIncomingCall((current) => (current?.id === id ? null : current));
    }, INCOMING_RING_MS);
    return () => window.clearTimeout(timer);
  }, [incomingCall]);

  // Closing the tab mid-call: tell Django now rather than letting LiveKit's
  // webhook notice when the connection times out.
  useEffect(() => {
    const onPageHide = () => {
      const call = activeCallRef.current;
      if (call) void requestLeaveCall(call.id, { keepalive: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const dismissNotice = useCallback(() => {
    setNotice(null);
    setPhase((current) => (current === "ended" ? "idle" : current));
  }, []);
  const dismissError = useCallback(() => setError(null), []);

  const conversationFor = useCallback(
    (call: Call) => findConversation(conversations, call.conversationId),
    [conversations],
  );

  // Mirrors calls/services.py `may_administer`: whoever started it, either
  // person in a one-to-one, or an admin of the group. The server checks again.
  const canAdministerActiveCall = useMemo(() => {
    if (!activeCall) return false;
    if (
      userProfile.username &&
      activeCall.createdBy?.username === userProfile.username
    ) {
      return true;
    }
    const conversation = findConversation(
      conversations,
      activeCall.conversationId,
    );
    return conversation?.kind === "direct" || conversation?.isAdmin === true;
  }, [activeCall, conversations, userProfile.username]);

  const value = useMemo<CallContextType>(
    () => ({
      phase,
      activeCall,
      pendingStart,
      incomingCall,
      liveCallsByConversation,
      notice,
      error,
      isMinimized,
      isRecordingBusy,
      canAdministerActiveCall,
      media,
      startCall,
      joinCall,
      acceptIncomingCall,
      declineIncomingCall,
      leaveCall,
      endCallForEveryone,
      toggleRecording,
      rejoinActiveCall,
      setMinimized,
      dismissNotice,
      dismissError,
      conversationFor,
    }),
    [
      phase,
      activeCall,
      pendingStart,
      incomingCall,
      liveCallsByConversation,
      notice,
      error,
      isMinimized,
      isRecordingBusy,
      canAdministerActiveCall,
      media,
      startCall,
      joinCall,
      acceptIncomingCall,
      declineIncomingCall,
      leaveCall,
      endCallForEveryone,
      toggleRecording,
      rejoinActiveCall,
      dismissNotice,
      dismissError,
      conversationFor,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCalls() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCalls must be used within CallProvider");
  }
  return context;
}
