"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  fetchUserProfile,
  getSession,
  logout,
  updateUserProfile,
  type ProfileResult,
} from "@/lib/auth/client";
import {
  addConversationMembers,
  fetchConversation,
  fetchConversationParticipants,
  fetchConversations,
  fetchJoinCode,
  fetchJoinRequests,
  fetchMessageHistory,
  inviteConversationMemberByPhone,
  joinConversation,
  joinConversationWithCode,
  leaveConversation,
  normalizeParticipant,
  removeConversationMember,
  respondToJoinRequest,
  searchConversations,
  sendConversationMessage,
  updateGroupSettings,
  updateMemberRole,
  type Conversation,
  type ConversationAttachment,
  type ConversationMessage,
  type ConversationParticipant,
  type GroupSettings,
} from "@/lib/chat/conversations";
import { CreateLoopModal } from "./CreateLoopModal";
import { JoinLoopModal } from "./JoinLoopModal";
import { AddMembersModal } from "./AddMembersModal";
import { LoopAdminPanel, type AdminTab } from "./LoopAdminPanel";
import { LoopWebSocketManager } from "./LoopWebSocketManager";
import { NotificationBadge } from "./NotificationBadge";
import { VerifyPhoneModal } from "./VerifyPhoneModal";
import {
  UserSettingsModal,
  type UserProfile,
} from "@/components/settings/UserSettingsModal";
import { Code, Plus } from "lucide-react";

type Message = {
  id: string | number;
  sender: string;
  senderUsername?: string;
  text: string;
  mine: boolean;
  time: string;
  attachments?: ConversationMessage["attachments"];
};

type WebSocketMessage = {
  type: string;
  message?: Record<string, unknown>;
  [key: string]: unknown;
};

type HomeShellProps = {
  displayName: string;
};

// Initialize with empty list - user creates loops as needed
const defaultConversations: Conversation[] = [];
const messageEmojis = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "🤣",
  "😂",
  "🙂",
  "🙃",
  "😉",
  "😊",
  "😇",
  "🥰",
  "😍",
  "🤩",
  "😘",
  "😋",
  "😛",
  "😜",
  "🤪",
  "🤗",
  "🤔",
  "🫡",
  "🤭",
  "🤫",
  "🤐",
  "😐",
  "😑",
  "😶",
  "🙄",
  "😏",
  "😣",
  "😥",
  "😮",
  "🤐",
  "😯",
  "😪",
  "😫",
  "🥱",
  "😴",
  "😌",
  "🤓",
  "😎",
  "🥳",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥺",
  "😱",
  "😨",
  "😰",
  "😓",
  "🤗",
  "😵",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "👍",
  "👎",
  "👌",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "🤙",
  "👏",
  "🙌",
  "👐",
  "🤝",
  "🙏",
  "💪",
  "👀",
  "👋",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "✨",
  "⭐",
  "🌟",
  "💫",
  "🔥",
  "🎉",
  "🎊",
  "✅",
  "❌",
  "⚠️",
  "💯",
  "💡",
  "🎯",
  "🚀",
  "🌈",
  "☀️",
  "🌙",
  "☕",
  "🍕",
  "🍔",
  "🍰",
  "🍻",
  "⚽",
  "🏀",
  "🏆",
  "🎵",
  "🎸",
  "🎮",
  "📱",
  "💻",
  "📸",
  "🎁",
  "💬",
  "💭",
  "📌",
  "🔔",
  "🔒",
  "🔑",
];

// Mock data for admin panel
const mockMembers = [
  {
    id: "1",
    name: "You",
    email: "you@example.com",
    role: "admin" as const,
    joinedAt: "Jan 15, 2024",
    isBlocked: false,
    lastActive: "2 minutes ago",
  },
  {
    id: "2",
    name: "Sarah",
    phone: "+1 (555) 123-4567",
    role: "member" as const,
    joinedAt: "Jan 20, 2024",
    isBlocked: false,
    lastActive: "1 hour ago",
  },
  {
    id: "3",
    name: "John",
    email: "john@example.com",
    role: "moderator" as const,
    joinedAt: "Jan 18, 2024",
    isBlocked: false,
    lastActive: "3 hours ago",
  },
  {
    id: "4",
    name: "Mike",
    email: "mike@example.com",
    role: "member" as const,
    joinedAt: "Feb 1, 2024",
    isBlocked: true,
    lastActive: "1 week ago",
  },
];

export function HomeShell({ displayName }: HomeShellProps) {
  const router = useRouter();
  const [conversations, setConversations] =
    useState<Conversation[]>(defaultConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | number | null
  >(defaultConversations.length > 0 ? defaultConversations[0].id : null);
  const [isCreateLoopOpen, setIsCreateLoopOpen] = useState(false);
  const [isJoinLoopOpen, setIsJoinLoopOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [groupSettings, setGroupSettings] = useState<GroupSettings | null>(
    null,
  );
  const [isGroupSettingsLoading, setIsGroupSettingsLoading] = useState(true);
  const [adminPanelTab, setAdminPanelTab] = useState<AdminTab>("settings");
  // Actual pending join requests per Loop this user administers - the admin
  // panel's worklist. Only shrinks on approve/decline, never on "seen".
  const [pendingRequestsByLoop, setPendingRequestsByLoop] = useState<
    Map<string | number, ConversationParticipant[]>
  >(new Map());
  // How many of those requests haven't been looked at yet, per Loop - this is
  // what drives the notification badges. Resets to 0 when the admin opens
  // the Members tab for that Loop; independent of the worklist above.
  const [unseenRequestCountByLoop, setUnseenRequestCountByLoop] = useState<
    Map<string | number, number>
  >(new Map());
  const [loadingPendingRequestLoopIds, setLoadingPendingRequestLoopIds] =
    useState<Set<string | number>>(new Set());
  const seededPendingRequestLoopIds = useRef<Set<string | number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pendingConversation, setPendingConversation] =
    useState<Conversation | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const [isJoiningPending, setIsJoiningPending] = useState(false);
  const [pendingJoinError, setPendingJoinError] = useState("");
  const [pendingJoinRequestSent, setPendingJoinRequestSent] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isVerifyPhoneOpen, setIsVerifyPhoneOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({ displayName });
  useEffect(() => {
    let cancelled = false;

    fetchConversations().then((result) => {
      if (cancelled || !result.ok) return;
      setConversations(() =>
        result.conversations.map((conversation, index) => ({
          ...conversation,
          active: index === 0,
        })),
      );
      setSelectedConversationId(result.conversations[0]?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fill in email/phone (and a real display name) from the backend profile.
  useEffect(() => {
    let cancelled = false;

    fetchUserProfile().then((result) => {
      if (cancelled || !result.ok) return;

      setUserProfile((prev) => ({
        displayName: result.displayName || prev.displayName,
        email: result.email ?? prev.email,
        phone: result.phone ?? prev.phone,
        emailVerified: result.emailVerified ?? prev.emailVerified,
        phoneVerified: result.phoneVerified ?? prev.phoneVerified,
        bio: result.bio ?? prev.bio,
        avatarUrl: result.avatarUrl ?? prev.avatarUrl,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Gate actions that need a verified phone (Create Loop, etc.) behind the modal.
  function requirePhoneVerified(action: () => void) {
    // Check if the user's phone is verified before performing the action.
    // if (phoneVerified) {
    action();
    //   return;
    // }

    // setIsVerifyPhoneOpen(true);
  }

  // Store messages per loop
  const [loopMessages, setLoopMessages] = useState<
    Map<string | number, Message[]>
  >(new Map());

  // Store WebSocket status per loop
  const [loopWSStatus, setLoopWSStatus] = useState<
    Map<string | number, string>
  >(new Map());

  // Message input state
  const [messageInput, setMessageInput] = useState("");
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordError, setVoiceRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentUsername = getSession();

  const stopVoiceStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  // Records to a File the same shape file uploads produce, so it rides the
  // existing attachments pipeline (pill list, FormData upload, playback).
  const handleStartRecording = useCallback(async () => {
    if (isSendingMessage || isRecordingVoice) return;
    setVoiceRecordError(null);

    if (typeof MediaRecorder === "undefined") {
      setVoiceRecordError("Voice messages aren't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopVoiceStream();
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        recordedChunksRef.current = [];
        if (blob.size === 0) return;

        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File(
          [blob],
          `voice-message-${Date.now()}.${extension}`,
          { type: mimeType },
        );
        setMessageAttachments((current) => [...current, file]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setVoiceRecordError("Microphone access was denied.");
      stopVoiceStream();
    }
  }, [isSendingMessage, isRecordingVoice, stopVoiceStream]);

  const handleStopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
  }, []);

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      stopVoiceStream();
    };
  }, [stopVoiceStream]);

  const toUiMessage = useCallback(
    (message: ConversationMessage): Message => {
      return {
        id: message.id,
        sender: message.sender,
        senderUsername: message.senderUsername,
        text: message.text,
        mine:
          message.mine ||
          Boolean(
            currentUsername && message.senderUsername === currentUsername,
          ),
        time: message.createdAt
          ? new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        attachments: message.attachments,
      };
    },
    [currentUsername],
  );

  function appendEmoji(emoji: string) {
    setMessageInput((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  }

  const selectedConversation = selectedConversationId
    ? conversations.find((c) => c.id === selectedConversationId)
    : null;
  const isSelectedConversationAdmin = selectedConversation?.isAdmin === true;
  const canAddMembers =
    isSelectedConversationAdmin ||
    groupSettings?.add_member_permission !== "admins";
  const canEditGroupSettings =
    isSelectedConversationAdmin ||
    groupSettings?.edit_group_permission !== "admins";

  // Get messages for selected loop
  const currentMessages = selectedConversationId
    ? loopMessages.get(selectedConversationId) || []
    : [];

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      setIsSearching(true);
      searchConversations(query).then((result) => {
        if (cancelled) return;
        setIsSearching(false);
        if (!result.ok) {
          setSearchError(result.message);
          setSearchResults([]);
          return;
        }
        setSearchError("");
        setSearchResults(result.conversations);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;

    fetchConversation(selectedConversationId).then((result) => {
      if (cancelled) return;
      setIsGroupSettingsLoading(false);
      setGroupSettings(result.ok ? result.conversation.settings : null);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

  // Seed pending join-request counts for every Loop this user administers,
  // as soon as it shows up in the conversation list - not only once the
  // admin panel happens to be opened for it. Drives the Invites badge.
  useEffect(() => {
    const adminApprovalLoops = conversations.filter(
      (conversation) =>
        conversation.isAdmin && conversation.joinMode === "approval",
    );
    const toFetch = adminApprovalLoops.filter(
      (loop) => !seededPendingRequestLoopIds.current.has(loop.id),
    );
    if (toFetch.length === 0) return;
    toFetch.forEach((loop) => seededPendingRequestLoopIds.current.add(loop.id));

    let cancelled = false;
    setLoadingPendingRequestLoopIds((prev) => {
      const next = new Set(prev);
      toFetch.forEach((loop) => next.add(loop.id));
      return next;
    });

    Promise.all(
      toFetch.map((loop) =>
        fetchJoinRequests(loop.id).then((result) => ({
          loopId: loop.id,
          result,
        })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setPendingRequestsByLoop((prev) => {
        const next = new Map(prev);
        for (const { loopId, result } of results) {
          if (result.ok) next.set(loopId, result.requests);
        }
        return next;
      });
      setUnseenRequestCountByLoop((prev) => {
        const next = new Map(prev);
        for (const { loopId, result } of results) {
          if (result.ok) next.set(loopId, result.requests.length);
        }
        return next;
      });
      setLoadingPendingRequestLoopIds((prev) => {
        const next = new Set(prev);
        results.forEach(({ loopId }) => next.delete(loopId));
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [conversations]);

  // Refresh the full participant list (and this user's admin status) for the
  // Loop that's currently open - the list endpoint's participants can be
  // stale or paginated, and the admin panel needs the authoritative roster.
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;

    fetchConversationParticipants(selectedConversationId).then((result) => {
      if (cancelled || !result.ok) return;
      const isAdmin = result.participants.some(
        (participant) =>
          participant.role === "admin" &&
          participant.username === currentUsername,
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? { ...conversation, participants: result.participants, isAdmin }
            : conversation,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, currentUsername]);

  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;

    fetchMessageHistory(selectedConversationId).then((result) => {
      if (cancelled) return;
      setIsMessagesLoading(false);
      setMessageError(null);
      if (!result.ok) {
        setMessageError(result.message);
        return;
      }
      setLoopMessages((previous) => {
        const next = new Map(previous);
        next.set(selectedConversationId, result.messages.map(toUiMessage));
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, toUiMessage]);

  async function handleLogout() {
    await logout();
    router.push("/login/");
  }

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "message.new") {
        const eventMessage = message.message;
        if (!eventMessage || typeof eventMessage !== "object") return;
        const rawMessage = eventMessage as Record<string, unknown>;
        const eventConversationId = rawMessage.conversation;
        // This single socket receives messages for every Loop the user is
        // in, not just the one currently open - resolve which Loop this
        // message belongs to so background Loops can still track unread.
        const messageConversationId =
          typeof eventConversationId === "object" &&
          eventConversationId !== null
            ? (eventConversationId as Record<string, unknown>).id
            : eventConversationId;
        const targetConversationId = (messageConversationId ??
          selectedConversationId) as string | number | null;
        if (targetConversationId === null || targetConversationId === undefined)
          return;
        const isForSelectedConversation =
          targetConversationId === selectedConversationId;
        const rawSender = rawMessage.sender;
        const sender =
          rawSender && typeof rawSender === "object"
            ? String(
                (rawSender as Record<string, unknown>).display_label ??
                  (rawSender as Record<string, unknown>).username ??
                  "Unknown",
              )
            : String(rawSender ?? "Unknown");
        const attachments = Array.isArray(rawMessage.attachments)
          ? rawMessage.attachments.flatMap((attachment) => {
              if (
                !attachment ||
                typeof attachment !== "object" ||
                typeof (attachment as Record<string, unknown>).url !== "string"
              ) {
                return [];
              }
              const rawAttachment = attachment as Record<string, unknown>;
              const url = rawAttachment.url as string;
              return [
                {
                  id:
                    typeof rawAttachment.id === "string" ||
                    typeof rawAttachment.id === "number"
                      ? rawAttachment.id
                      : undefined,
                  url,
                  originalName: String(
                    rawAttachment.original_name ?? "Attachment",
                  ),
                  contentType: String(rawAttachment.content_type ?? ""),
                } satisfies ConversationAttachment,
              ];
            })
          : [];
        const newMessage = toUiMessage({
          ...(eventMessage as ConversationMessage),
          conversationId: targetConversationId,
          id: rawMessage.id as string | number,
          sender,
          senderUsername:
            rawSender && typeof rawSender === "object"
              ? String((rawSender as Record<string, unknown>).username ?? "")
              : String(rawSender ?? ""),
          text: String(rawMessage.text ?? ""),
          createdAt: String(rawMessage.created_at ?? new Date().toISOString()),
          attachments,
          mine:
            rawMessage.mine === true ||
            (currentUsername !== null &&
              String(
                rawSender && typeof rawSender === "object"
                  ? ((rawSender as Record<string, unknown>).username ?? "")
                  : (rawSender ?? ""),
              ) === currentUsername),
        });

        if (isForSelectedConversation) {
          setLoopMessages((prev) => {
            const map = new Map(prev);
            const messages = map.get(targetConversationId) || [];
            if (messages.some((existing) => existing.id === newMessage.id))
              return prev;
            map.set(targetConversationId, [...messages, newMessage]);
            return map;
          });
        }

        // Update the preview everywhere, but only bump the unread badge for
        // a Loop that isn't the one currently open - that one is being read.
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConversationId
              ? {
                  ...c,
                  preview: newMessage.text.substring(0, 50),
                  unread: isForSelectedConversation ? 0 : (c.unread || 0) + 1,
                }
              : c,
          ),
        );
      } else if (message.type === "conversation.added") {
        fetchConversations().then((result) => {
          if (result.ok) setConversations(result.conversations);
        });
      } else if (message.type === "conversation.request") {
        const rawConversationId = message.conversation_id;
        const conversationId =
          typeof rawConversationId === "string" ||
          typeof rawConversationId === "number"
            ? rawConversationId
            : undefined;
        const participant = normalizeParticipant(message.participant);
        if (conversationId === undefined || !participant) return;

        setPendingRequestsByLoop((prev) => {
          const existing = prev.get(conversationId) ?? [];
          if (existing.some((request) => request.id === participant.id))
            return prev;
          const next = new Map(prev);
          next.set(conversationId, [...existing, participant]);
          return next;
        });
        setUnseenRequestCountByLoop((prev) => {
          const next = new Map(prev);
          next.set(conversationId, (next.get(conversationId) ?? 0) + 1);
          return next;
        });
      }
    },
    [currentUsername, selectedConversationId, toUiMessage],
  );

  const handleWebSocketConnected = useCallback(() => {
    if (selectedConversationId) {
      setLoopWSStatus((prev) => {
        const map = new Map(prev);
        map.set(selectedConversationId, "connected");
        return map;
      });
    }
  }, [selectedConversationId]);

  const handleWebSocketDisconnected = useCallback(() => {
    if (selectedConversationId) {
      setLoopWSStatus((prev) => {
        const map = new Map(prev);
        map.set(selectedConversationId, "disconnected");
        return map;
      });
    }
  }, [selectedConversationId]);

  const handleWebSocketError = useCallback(
    (error: Error) => {
      if (selectedConversationId) {
        setLoopWSStatus((prev) => {
          const map = new Map(prev);
          map.set(selectedConversationId, "error");
          return map;
        });
        console.error(
          `WebSocket error for loop ${selectedConversationId}:`,
          error,
        );
      }
    },
    [selectedConversationId],
  );

  const handleSendMessage = useCallback(async () => {
    if (
      (!messageInput.trim() && messageAttachments.length === 0) ||
      !selectedConversationId ||
      isSendingMessage
    )
      return;
    setIsSendingMessage(true);
    setMessageError(null);
    const result = await sendConversationMessage(
      selectedConversationId,
      messageInput,
      messageAttachments,
    );
    if (!result.ok) {
      setMessageError(result.message);
    } else {
      setLoopMessages((previous) => {
        const next = new Map(previous);
        const messages = next.get(selectedConversationId) || [];
        if (!messages.some((message) => message.id === result.message.id)) {
          next.set(selectedConversationId, [
            ...messages,
            toUiMessage(result.message),
          ]);
        }
        return next;
      });
      setMessageInput("");
      setMessageAttachments([]);
    }
    setIsSendingMessage(false);
  }, [
    messageAttachments,
    messageInput,
    selectedConversationId,
    isSendingMessage,
    toUiMessage,
  ]);

  async function handleCreateLoopSuccess() {
    const result = await fetchConversations();
    if (!result.ok) return;

    setPendingConversation(null);
    setConversations(
      result.conversations.map((conversation) => ({
        ...conversation,
        active: false,
      })),
    );
    const newestConversation = result.conversations.at(-1);
    setSelectedConversationId(newestConversation?.id ?? null);
    setConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        active: conversation.id === newestConversation?.id,
      })),
    );
    setIsCreateLoopOpen(false);
  }

  async function handleAddMembers(members: string[]) {
    if (!selectedConversationId) return;
    const result = await addConversationMembers(
      selectedConversationId,
      members,
    );
    if (!result.ok) throw new Error(result.message);
    await refreshConversations();
  }

  async function handleInvitePhone(invite: {
    phone_number: string;
    display_name?: string;
  }) {
    if (!selectedConversationId) return;
    const result = await inviteConversationMemberByPhone(
      selectedConversationId,
      invite,
    );
    if (!result.ok) throw new Error(result.message);
    await refreshConversations();
  }

  async function handleJoinLoop(code: string) {
    const result = await joinConversationWithCode(code);
    if (!result.ok) throw new Error(result.message);

    setPendingConversation(null);
    setConversations((current) => {
      const withoutJoined = current.filter(
        (conversation) => conversation.id !== result.conversation.id,
      );
      return [
        ...withoutJoined.map((conversation) => ({
          ...conversation,
          active: false,
        })),
        { ...result.conversation, active: true },
      ];
    });
    setSelectedConversationId(result.conversation.id);
  }

  async function refreshConversations() {
    const refreshed = await fetchConversations();
    if (refreshed.ok) {
      setConversations(
        refreshed.conversations.map((conversation) => ({
          ...conversation,
          active: conversation.id === selectedConversationId,
        })),
      );
    }
  }

  function handleSelectConversation(conversationId: string | number) {
    setPendingConversation(null);
    setSelectedConversationId(conversationId);
    setConversations(
      conversations.map((c) => ({
        ...c,
        active: c.id === conversationId,
        unread: c.id === conversationId ? 0 : c.unread,
      })),
    );
  }

  function handleSelectSearchResult(conversation: Conversation) {
    setPendingJoinError("");
    setPendingJoinCode("");
    setPendingJoinRequestSent(false);
    setSelectedConversationId(null);
    setPendingConversation(conversation);
  }

  async function handleJoinPending() {
    if (!pendingConversation) return;
    setIsJoiningPending(true);
    setPendingJoinError("");
    const result = await joinConversation(pendingConversation.id);
    setIsJoiningPending(false);
    if (!result.ok) {
      setPendingJoinError(result.message);
      return;
    }
    if (result.status === "pending") {
      setPendingJoinRequestSent(true);
      return;
    }

    setPendingConversation(null);
    await refreshConversations();
    setSelectedConversationId(result.conversation.id);
  }

  async function handleJoinPendingWithCode() {
    if (!pendingJoinCode.trim()) {
      setPendingJoinError("Enter a join code.");
      return;
    }
    setIsJoiningPending(true);
    setPendingJoinError("");
    const result = await joinConversationWithCode(pendingJoinCode.trim());
    setIsJoiningPending(false);
    if (!result.ok) {
      setPendingJoinError(result.message);
      return;
    }

    setPendingConversation(null);
    await refreshConversations();
    setSelectedConversationId(result.conversation.id);
  }

  async function handleLeaveLoop(): Promise<
    { ok: true } | { ok: false; message: string }
  > {
    if (!selectedConversationId)
      return { ok: false, message: "No Loop selected." };
    const result = await leaveConversation(selectedConversationId);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    setConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== selectedConversationId,
      );
      return remaining.map((conversation, index) => ({
        ...conversation,
        active: index === 0,
      }));
    });
    setSelectedConversationId((current) => {
      const remaining = conversations.filter(
        (conversation) => conversation.id !== current,
      );
      return remaining[0]?.id ?? null;
    });

    return { ok: true };
  }

  function renderConversationButton(conversation: Conversation) {
    return (
      <button
        key={conversation.id}
        type="button"
        onClick={() => handleSelectConversation(conversation.id)}
        className={`w-full rounded-xl p-3 text-left transition ${
          conversation?.active
            ? "bg-sky-600 text-white shadow-[0_8px_25px_rgba(13,108,190,0.35)]"
            : "bg-white text-slate-700 hover:bg-sky-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{conversation?.name}</p>
              {conversation?.isAdmin && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                  ADMIN
                </span>
              )}
            </div>
            <p
              className={`mt-0.5 text-xs ${
                conversation.active
                  ? "text-sky-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {conversation.preview}
            </p>
          </div>
          <NotificationBadge count={conversation.unread} />
        </div>
      </button>
    );
  }

  // Requests that are still waiting on a decision - the Invites worklist.
  const loopsWithPendingRequests = conversations.filter(
    (conversation) =>
      (pendingRequestsByLoop.get(conversation.id)?.length ?? 0) > 0,
  );
  // Requests nobody has looked at yet - drives the Invites badge specifically.
  const totalUnseenInvites = Array.from(
    unseenRequestCountByLoop.values(),
  ).reduce((sum, count) => sum + count, 0);
  const totalUnreadMessages = conversations.reduce(
    (sum, conversation) => sum + (conversation.unread || 0),
    0,
  );
  const totalNotifications = totalUnreadMessages + totalUnseenInvites;

  function handleOpenInvites() {
    const loop = loopsWithPendingRequests[0];
    if (!loop) return;
    handleSelectConversation(loop.id);
    setAdminPanelTab("members");
    setIsAdminPanelOpen(true);
  }

  function handleTabChange(tab: AdminTab) {
    setAdminPanelTab(tab);
    if (tab === "members" && selectedConversationId) {
      setUnseenRequestCountByLoop((prev) => {
        if (!prev.get(selectedConversationId)) return prev;
        const next = new Map(prev);
        next.set(selectedConversationId, 0);
        return next;
      });
    }
  }

  const chatLoops = conversations.filter(
    (c) => c.settings?.mode !== "broadcast",
  );
  const broadcastLoops = conversations.filter(
    (c) => c.settings?.mode === "broadcast",
  );
  const canPostMessage =
    selectedConversation?.mode !== "broadcast" || selectedConversation?.isAdmin;

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#e4f4ff_0%,#f8fbff_50%,#f3f8ff_100%)] p-3 sm:p-5 dark:bg-[linear-gradient(160deg,#0b1220_0%,#0e1626_50%,#0b1220_100%)]">
      <div className="mx-auto grid h-[94vh] min-h-0 w-full max-w-7xl overflow-hidden rounded-3xl border border-white/70 bg-white/50 shadow-[0_22px_80px_rgba(14,88,148,0.16)] backdrop-blur-md md:grid-cols-[320px_1fr] dark:border-slate-800 dark:bg-slate-900/60">
        <aside className="border-b border-sky-100 bg-white/85 p-4 md:border-r md:border-b-0 md:p-5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 justify-between w-full">
              <div className="flex items-center gap-2 justify-center">
                <p className="text-xs uppercase tracking-[0.14em] text-sky-500">
                  Loopd&apos;n
                </p>
                <NotificationBadge count={totalNotifications} />
                <p
                  title={displayName}
                  className="rounded-xl bg-cyan-50 px-3 py-2 max-w-[120px] truncate text-xs text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300"
                >
                  {displayName}
                </p>
              </div>
              <div className="flex items-center gap-2 w-auto">
                <button
                  type="button"
                  title="Create Loop"
                  onClick={() =>
                    requirePhoneVerified(() => setIsCreateLoopOpen(true))
                  }
                  className="flex items-center justify-center w-8 rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-2 py-1 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110"
                >
                  <Plus className="h-5 w-5 font-bold" />
                </button>
                <button
                  type="button"
                  title="User Settings"
                  onClick={() => setIsUserSettingsOpen(true)}
                  className="py-1.5 px-0 w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  ⚙️
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                const value = event.target.value;
                setSearchQuery(value);
                if (!value.trim()) {
                  setSearchResults([]);
                  setSearchError("");
                }
              }}
              placeholder="Search Loops..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              title="Join Loop with Code"
              onClick={() =>
                requirePhoneVerified(() => setIsJoinLoopOpen(true))
              }
              className="flex items-center justify-center w-10 rounded-xl border border-sky-200 bg-white px-2 p-1 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400 dark:hover:bg-slate-700"
            >
              <Code className="h-5 w-5" />
            </button>
          </div>

          {loopsWithPendingRequests.length > 0 && (
            <button
              type="button"
              onClick={handleOpenInvites}
              className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Invites
                </p>
                <NotificationBadge count={totalUnseenInvites} />
              </div>
            </button>
          )}

          {searchQuery.trim() ? (
            <div className="space-y-2">
              {isSearching ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  Searching...
                </p>
              ) : searchError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-4 text-center text-xs text-rose-700">
                  {searchError}
                </p>
              ) : searchResults.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  No Loops found
                </p>
              ) : (
                searchResults.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(conversation)}
                    className={`w-full rounded-xl p-3 text-left transition ${
                      pendingConversation?.id === conversation.id
                        ? "bg-sky-600 text-white shadow-[0_8px_25px_rgba(13,108,190,0.35)]"
                        : "bg-white text-slate-700 hover:bg-sky-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <p className="text-sm font-semibold">{conversation.name}</p>
                    <p
                      className={`mt-0.5 text-xs ${
                        pendingConversation?.id === conversation.id
                          ? "text-sky-100"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {conversation.description || "No description"}
                    </p>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {conversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50 p-6 text-center dark:border-sky-800 dark:bg-sky-950/30">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    No Loops yet
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Click Create Loop above to get started
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Chat Loops
                    </p>
                    {chatLoops.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                        No chat loops yet
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {chatLoops.map(renderConversationButton)}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Broadcast Loops
                    </p>
                    {broadcastLoops.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                        No broadcast loops yet
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-50 overflow-y-auto">
                        {broadcastLoops.map(renderConversationButton)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-[linear-gradient(180deg,#fafeff_0%,#f5faff_100%)] dark:bg-[linear-gradient(180deg,#0e1626_0%,#0b1220_100%)]">
          {selectedConversationId && (
            <LoopWebSocketManager
              loopId={selectedConversationId}
              onMessage={handleWebSocketMessage}
              onConnected={handleWebSocketConnected}
              onDisconnected={handleWebSocketDisconnected}
              onError={handleWebSocketError}
            />
          )}

          <header className="flex items-center justify-between border-b border-sky-100 px-5 py-4 dark:border-slate-800">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Group
              </p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {selectedConversation?.name ||
                  pendingConversation?.name ||
                  "Select a Loop"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {selectedConversationId && (
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {selectedConversation?.participants.length ?? 0} member
                  {(selectedConversation?.participants.length ?? 0) === 1
                    ? ""
                    : "s"}
                </div>
              )}

              {/* WebSocket Status Indicator */}
              {selectedConversationId && (
                <div
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                    loopWSStatus.get(selectedConversationId) === "connected"
                      ? "bg-emerald-100 text-emerald-700"
                      : loopWSStatus.get(selectedConversationId) ===
                          "connecting"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                  title={`WebSocket: ${loopWSStatus.get(selectedConversationId) || "disconnected"}`}
                >
                  {loopWSStatus.get(selectedConversationId) === "connected" &&
                    "🟢 Live"}
                  {loopWSStatus.get(selectedConversationId) === "connecting" &&
                    "🟡 Connecting"}
                  {!loopWSStatus.get(selectedConversationId) && "⚫ Offline"}
                </div>
              )}

              {selectedConversationId && (
                <div className="flex items-center gap-2">
                  {canAddMembers && (
                    <button
                      type="button"
                      onClick={() => setIsAddMembersOpen(true)}
                      title="Add members"
                      aria-label="Add members"
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19a4 4 0 00-8 0m4-8a4 4 0 100-8 4 4 0 000 8zm6 3v6m3-3h-6"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAdminPanelTab("settings");
                      setIsAdminPanelOpen(true);
                    }}
                    title="Loop Settings"
                    aria-label="Loop Settings"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="min-h-0 max-h-[calc(94vh-150px)] flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-6">
            {pendingConversation ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-sm rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-[0_10px_30px_rgba(14,88,148,0.15)] dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {pendingConversation.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {pendingConversation.description || "No description"}
                  </p>

                  {pendingJoinRequestSent ? (
                    <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Request sent. An admin needs to approve your request to
                      join.
                    </p>
                  ) : pendingConversation.joinMode === "code" ? (
                    <div className="mt-4 space-y-3">
                      <input
                        type="text"
                        value={pendingJoinCode}
                        onChange={(event) =>
                          setPendingJoinCode(event.target.value)
                        }
                        placeholder="Enter join code"
                        disabled={isJoiningPending}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm uppercase tracking-widest text-slate-800 outline-none transition placeholder:normal-case placeholder:tracking-normal focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleJoinPendingWithCode}
                        disabled={isJoiningPending || !pendingJoinCode.trim()}
                        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isJoiningPending ? "Joining..." : "Submit Code"}
                      </button>
                    </div>
                  ) : pendingConversation.joinMode === "invite" ? (
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                      This Loop is invite-only. Ask a member to invite you.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleJoinPending}
                      disabled={isJoiningPending}
                      className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isJoiningPending
                        ? "Joining..."
                        : pendingConversation.joinMode === "approval"
                          ? "Request to Join"
                          : "Join Group"}
                    </button>
                  )}

                  {pendingJoinError && (
                    <p className="mt-3 text-xs text-rose-600">
                      {pendingJoinError}
                    </p>
                  )}
                </div>
              </div>
            ) : !selectedConversation ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sky-100 p-4 dark:bg-sky-950/40">
                    <svg
                      className="h-full w-full text-sky-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6h6"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    No Loop Selected
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Create a Loop to get started!
                  </p>
                </div>
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    No messages yet
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              currentMessages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-xl rounded-2xl px-4 py-3 ${
                    message.mine
                      ? "ml-auto bg-sky-600 text-white"
                      : "bg-white text-slate-800 shadow-[0_4px_16px_rgba(26,85,133,0.08)] dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p
                    className={`text-xs ${message.mine ? "text-sky-100" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {message.sender}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{message.text}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((attachment) => (
                        <div key={attachment.id ?? attachment.url}>
                          {attachment.contentType?.startsWith("audio/") && (
                            <audio
                              controls
                              src={attachment.url}
                              className="mb-1 max-w-full"
                            />
                          )}
                          {attachment.contentType?.startsWith("image/") && (
                            <Image
                              src={attachment.url}
                              alt={attachment.originalName}
                              width={400}
                              height={224}
                              unoptimized
                              className="mb-1 max-h-56 max-w-full rounded-lg object-cover"
                            />
                          )}
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`block truncate text-xs underline ${message.mine ? "text-sky-100" : "text-sky-700"}`}
                          >
                            {attachment.originalName}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  <p
                    className={`mt-2 text-[11px] ${message.mine ? "text-sky-100" : "text-slate-400"}`}
                  >
                    {message.time}
                  </p>
                </article>
              ))
            )}
          </div>

          <footer className="shrink-0 border-t border-sky-100 p-4 dark:border-slate-800">
            {pendingConversation ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Join this Loop to start chatting
                </p>
              </div>
            ) : !selectedConversation ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select or create a Loop to start chatting
                </p>
              </div>
            ) : (
              <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_6px_20px_rgba(30,89,138,0.09)] dark:border-slate-700 dark:bg-slate-800">
                {messageError && (
                  <p className="px-2 pb-2 text-xs text-rose-600">
                    {messageError}
                  </p>
                )}
                {voiceRecordError && (
                  <p className="px-2 pb-2 text-xs text-rose-600">
                    {voiceRecordError}
                  </p>
                )}
                {isRecordingVoice && (
                  <p className="flex items-center gap-2 px-2 pb-2 text-xs text-rose-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                    Recording voice message...
                  </p>
                )}
                {isMessagesLoading && (
                  <p className="px-2 pb-2 text-xs text-slate-500">
                    Loading messages...
                  </p>
                )}
                {messageAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    {messageAttachments.map((file, index) => (
                      <button
                        key={`${file.name}-${file.lastModified}`}
                        type="button"
                        onClick={() =>
                          setMessageAttachments((current) =>
                            current.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          )
                        }
                        className="max-w-full truncate rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-rose-100 hover:text-rose-700"
                        title="Remove attachment"
                      >
                        {file.name} ×
                      </button>
                    ))}
                  </div>
                )}
                {canPostMessage ? (
                  <div className="flex gap-2">
                    <label
                      className="flex cursor-pointer items-center px-2 text-slate-500"
                      title="Attach files"
                    >
                      <span aria-hidden="true">📎</span>
                      <input
                        type="file"
                        multiple
                        onChange={(event) =>
                          setMessageAttachments(
                            Array.from(event.target.files ?? []),
                          )
                        }
                        disabled={isSendingMessage}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((current) => !current)}
                      disabled={isSendingMessage}
                      className="px-1 text-slate-500"
                      title="Add emoji"
                      aria-label="Add emoji"
                    >
                      😊
                    </button>
                    <button
                      type="button"
                      onClick={
                        isRecordingVoice
                          ? handleStopRecording
                          : handleStartRecording
                      }
                      disabled={isSendingMessage}
                      className={`px-1 ${isRecordingVoice ? "text-rose-600" : "text-slate-500"}`}
                      title={
                        isRecordingVoice
                          ? "Stop recording"
                          : "Record a voice message"
                      }
                      aria-label={
                        isRecordingVoice
                          ? "Stop recording"
                          : "Record a voice message"
                      }
                    >
                      {isRecordingVoice ? "⏹️" : "🎙️"}
                    </button>
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isSendingMessage}
                      className="w-full bg-transparent px-2 text-sm text-slate-700 placeholder-slate-400 outline-none dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={
                        isSendingMessage ||
                        (!messageInput.trim() &&
                          messageAttachments.length === 0)
                      }
                      className="rounded-xl bg-[linear-gradient(130deg,#02adff_0%,#297be3_100%)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isSendingMessage ? "Sending..." : "Send"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                    Only Admins Can Post Messages
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(30,89,138,0.18)] dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Choose an emoji
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label="Close emoji picker"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
                      {messageEmojis.map((emoji, index) => (
                        <button
                          key={`${emoji}-${index}`}
                          type="button"
                          onClick={() => appendEmoji(emoji)}
                          className="flex aspect-square items-center justify-center rounded-lg text-lg hover:bg-sky-100 dark:hover:bg-slate-700"
                          aria-label={`Insert ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </footer>
        </section>
      </div>

      <CreateLoopModal
        isOpen={isCreateLoopOpen}
        onClose={() => setIsCreateLoopOpen(false)}
        onSuccess={handleCreateLoopSuccess}
      />

      <JoinLoopModal
        isOpen={isJoinLoopOpen}
        onClose={() => setIsJoinLoopOpen(false)}
        onJoin={handleJoinLoop}
      />

      {selectedConversationId && selectedConversation && (
        <AddMembersModal
          isOpen={isAddMembersOpen}
          groupName={selectedConversation.name}
          currentMemberCount={selectedConversation.participants.length}
          onClose={() => setIsAddMembersOpen(false)}
          onAddMembers={handleAddMembers}
          onInvitePhone={handleInvitePhone}
        />
      )}

      {isVerifyPhoneOpen && (
        <VerifyPhoneModal
          onVerified={() => {
            setIsVerifyPhoneOpen(false);
            setIsCreateLoopOpen(true);
          }}
          onClose={() => setIsVerifyPhoneOpen(false)}
        />
      )}

      {isAdminPanelOpen && selectedConversationId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-start justify-center bg-black/50 p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsAdminPanelOpen(false)}
                className="sticky top-4 right-4 z-10 float-right rounded-lg bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Admin Panel Content */}
              <div className="p-6">
                <LoopAdminPanel
                  loopName={selectedConversation?.name ?? "Loop"}
                  settings={groupSettings}
                  isSettingsLoading={isGroupSettingsLoading}
                  canEditSettings={canEditGroupSettings}
                  canModerateMembers={isSelectedConversationAdmin}
                  activeTab={adminPanelTab}
                  onTabChange={handleTabChange}
                  handleLeaveLoop={handleLeaveLoop}
                  selectedConversation={
                    selectedConversation as { id?: string; name?: string }
                  }
                  members={selectedConversation?.participants ?? mockMembers}
                  pendingRequests={(
                    pendingRequestsByLoop.get(selectedConversationId) ?? []
                  ).map((request) => ({
                    id: request.id,
                    name: request.name,
                    username: request.username,
                    phone: request.phone,
                  }))}
                  isPendingRequestsLoading={loadingPendingRequestLoopIds.has(
                    selectedConversationId,
                  )}
                  onApproveRequest={async (participantId) => {
                    if (!selectedConversationId) return;
                    const result = await respondToJoinRequest(
                      selectedConversationId,
                      participantId,
                      "approve",
                    );
                    if (!result.ok) throw new Error(result.message);
                    setPendingRequestsByLoop((current) => {
                      const next = new Map(current);
                      next.set(
                        selectedConversationId,
                        (next.get(selectedConversationId) ?? []).filter(
                          (request) => request.id !== participantId,
                        ),
                      );
                      return next;
                    });
                    await refreshConversations();
                  }}
                  onDeclineRequest={async (participantId) => {
                    if (!selectedConversationId) return;
                    const result = await respondToJoinRequest(
                      selectedConversationId,
                      participantId,
                      "decline",
                    );
                    if (!result.ok) throw new Error(result.message);
                    setPendingRequestsByLoop((current) => {
                      const next = new Map(current);
                      next.set(
                        selectedConversationId,
                        (next.get(selectedConversationId) ?? []).filter(
                          (request) => request.id !== participantId,
                        ),
                      );
                      return next;
                    });
                  }}
                  onSaveSettings={async (settings) => {
                    if (!selectedConversationId) return;
                    const result = await updateGroupSettings(
                      selectedConversationId,
                      { settings },
                    );
                    if (!result.ok) throw new Error(result.message);
                    setGroupSettings(result.conversation.settings);
                  }}
                  onFetchJoinCode={async () => {
                    if (!selectedConversationId) {
                      throw new Error("No Loop selected.");
                    }
                    const result = await fetchJoinCode(selectedConversationId);
                    if (!result.ok) throw new Error(result.message);
                    return result.code;
                  }}
                  onUpdateMemberRole={async (memberId, role) => {
                    if (!selectedConversationId) return;
                    const result = await updateMemberRole(
                      selectedConversationId,
                      memberId,
                      role,
                    );
                    if (!result.ok) throw new Error(result.message);
                    await refreshConversations();
                  }}
                  onBlockMember={async (memberId) => {
                    if (!selectedConversationId) return;
                    const result = await removeConversationMember(
                      selectedConversationId,
                      memberId,
                      true,
                    );
                    if (!result.ok) throw new Error(result.message);
                    await refreshConversations();
                  }}
                  onUnblockMember={async () => {
                    throw new Error(
                      "Unblocking a member is not supported yet.",
                    );
                  }}
                  onRemoveMember={async (memberId) => {
                    if (!selectedConversationId) return;
                    const result = await removeConversationMember(
                      selectedConversationId,
                      memberId,
                      false,
                    );
                    if (!result.ok) throw new Error(result.message);
                    await refreshConversations();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        profile={userProfile}
        onSaveProfile={async (profile) => {
          const res: ProfileResult = await updateUserProfile(profile);
          if (!res.ok) {
            console.error("Failed to update profile:", res.message);
          }

          setUserProfile(res as UserProfile);
        }}
        onSaveNotifications={async (prefs) => {
          console.log("Saving notification preferences:", prefs);
          // Will connect to Django backend
        }}
        onLogout={handleLogout}
      />
    </main>
  );
}
