"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchUserProfile, getSession, logout } from "@/lib/auth/client";
import {
  fetchConversations,
  fetchMessageHistory,
  sendConversationMessage,
  type Conversation,
  type ConversationAttachment,
  type ConversationMessage,
} from "@/lib/chat/conversations";
import { CreateLoopModal } from "./CreateLoopModal";
import { LoopAdminPanel } from "./LoopAdminPanel";
import { LoopWebSocketManager } from "./LoopWebSocketManager";
import { VerifyPhoneModal } from "./VerifyPhoneModal";
import {
  UserSettingsModal,
  type UserProfile,
} from "@/components/settings/UserSettingsModal";

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
const mockLoopSettings = {
  id: "1",
  name: "Family HQ",
  posting_permission: "everyone" as const,
  reply_permission: "group" as const,
  voice_enabled: true,
  media_enabled: true,
  reactions_enabled: true,
  member_invitation_permission: "everyone" as const,
  new_member_history_visibility: "full" as const,
  plan_type: "ad_free" as const,
};

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
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
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
  const currentUsername = getSession();

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

  // Get messages for selected loop
  const currentMessages = selectedConversationId
    ? loopMessages.get(selectedConversationId) || []
    : [];

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
      if (!selectedConversationId) return;

      console.log("WebSocket message received:", message);

      if (message.type === "message.new") {
        const eventMessage = message.message;
        if (!eventMessage || typeof eventMessage !== "object") return;
        const rawMessage = eventMessage as Record<string, unknown>;
        const eventConversationId = rawMessage.conversation;
        if (
          eventConversationId !== undefined &&
          eventConversationId !== selectedConversationId &&
          !(
            typeof eventConversationId === "object" &&
            eventConversationId !== null &&
            (eventConversationId as Record<string, unknown>).id ===
              selectedConversationId
          )
        ) {
          return;
        }
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
              return [{
                id:
                  typeof rawAttachment.id === "string" ||
                  typeof rawAttachment.id === "number"
                    ? rawAttachment.id
                    : undefined,
                url,
                originalName: String(rawAttachment.original_name ?? "Attachment"),
                contentType: String(rawAttachment.content_type ?? ""),
              } satisfies ConversationAttachment];
            })
          : [];
        const newMessage = toUiMessage({
          ...(eventMessage as ConversationMessage),
          conversationId: selectedConversationId,
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
                  ? (rawSender as Record<string, unknown>).username ?? ""
                  : rawSender ?? "",
              ) === currentUsername),
        });

        setLoopMessages((prev) => {
          const map = new Map(prev);
          const messages = map.get(selectedConversationId) || [];
          if (messages.some((existing) => existing.id === newMessage.id)) return prev;
          map.set(selectedConversationId, [...messages, newMessage]);
          return map;
        });

        // Update preview in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? { ...c, preview: newMessage.text.substring(0, 50) }
              : c,
          ),
        );
      } else if (message.type === "conversation.added") {
        fetchConversations().then((result) => {
          if (result.ok) setConversations(result.conversations);
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
      console.log(`WebSocket connected for loop ${selectedConversationId}`);
    }
  }, [selectedConversationId]);

  const handleWebSocketDisconnected = useCallback(() => {
    if (selectedConversationId) {
      setLoopWSStatus((prev) => {
        const map = new Map(prev);
        map.set(selectedConversationId, "disconnected");
        return map;
      });
      console.log(`WebSocket disconnected for loop ${selectedConversationId}`);
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
    if ((!messageInput.trim() && messageAttachments.length === 0) || !selectedConversationId || isSendingMessage) return;
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
          next.set(selectedConversationId, [...messages, toUiMessage(result.message)]);
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

  function handleSelectConversation(conversationId: string | number) {
    setSelectedConversationId(conversationId);
    setConversations(
      conversations.map((c) => ({
        ...c,
        active: c.id === conversationId,
      })),
    );
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
          {conversation.unread > 0 && (
            <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-slate-900">
              {conversation.unread}
            </span>
          )}
        </div>
      </button>
    );
  }

  const chatLoops = conversations.filter(
    (c) => c.communicationMode !== "broadcast",
  );
  const broadcastLoops = conversations.filter(
    (c) => c.communicationMode === "broadcast",
  );

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#e4f4ff_0%,#f8fbff_50%,#f3f8ff_100%)] p-3 sm:p-5 dark:bg-[linear-gradient(160deg,#0b1220_0%,#0e1626_50%,#0b1220_100%)]">
      <div className="mx-auto grid h-[94vh] min-h-0 w-full max-w-7xl overflow-hidden rounded-3xl border border-white/70 bg-white/50 shadow-[0_22px_80px_rgba(14,88,148,0.16)] backdrop-blur-md md:grid-cols-[320px_1fr] dark:border-slate-800 dark:bg-slate-900/60">
        <aside className="border-b border-sky-100 bg-white/85 p-4 md:border-r md:border-b-0 md:p-5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 justify-between w-full">
              <p className="text-xs uppercase tracking-[0.14em] text-sky-500">
                Loopd&apos;n
              </p>
              <button
                type="button"
                onClick={() => setIsUserSettingsOpen(true)}
                className="py-1.5 px-0 w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ⚙️
              </button>
            </div>
          </div>

          <p className="mb-4 rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
            Signed in as {displayName}
          </p>

          <button
            type="button"
            onClick={() =>
              requirePhoneVerified(() => setIsCreateLoopOpen(true))
            }
            className="mb-4 w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110"
          >
            + Create Loop
          </button>

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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                      {broadcastLoops.map(renderConversationButton)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
                {selectedConversation?.name || "Select a Loop"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {selectedConversationId && (
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  0 member(s)
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
                <button
                  type="button"
                  onClick={() => setIsAdminPanelOpen(true)}
                  title="Loop Settings"
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
              )}
            </div>
          </header>

          <div className="min-h-0 max-h-[calc(94vh-150px)] flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-6">
            {!selectedConversation ? (
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
                          {attachment.contentType?.startsWith("image/") && (
                            <img
                              src={attachment.url}
                              alt={attachment.originalName}
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
            {!selectedConversation ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select or create a Loop to start chatting
                </p>
              </div>
            ) : (
              <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_6px_20px_rgba(30,89,138,0.09)] dark:border-slate-700 dark:bg-slate-800">
                {messageError && (
                  <p className="px-2 pb-2 text-xs text-rose-600">{messageError}</p>
                )}
                {isMessagesLoading && (
                  <p className="px-2 pb-2 text-xs text-slate-500">Loading messages...</p>
                )}
                {messageAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    {messageAttachments.map((file, index) => (
                      <button
                        key={`${file.name}-${file.lastModified}`}
                        type="button"
                        onClick={() =>
                          setMessageAttachments((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index),
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
                <div className="flex gap-2">
                  <label className="flex cursor-pointer items-center px-2 text-slate-500" title="Attach files">
                    <span aria-hidden="true">📎</span>
                    <input
                      type="file"
                      multiple
                      onChange={(event) => setMessageAttachments(Array.from(event.target.files ?? []))}
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
                  disabled={isSendingMessage || (!messageInput.trim() && messageAttachments.length === 0)}
                  className="rounded-xl bg-[linear-gradient(130deg,#02adff_0%,#297be3_100%)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSendingMessage ? "Sending..." : "Send"}
                </button>
                </div>
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

      {isVerifyPhoneOpen && (
        <VerifyPhoneModal
          onVerified={() => {
            setIsVerifyPhoneOpen(false);
            setIsCreateLoopOpen(true);
          }}
          onClose={() => setIsVerifyPhoneOpen(false)}
        />
      )}

      {isAdminPanelOpen && (
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
                  loopSettings={mockLoopSettings}
                  members={mockMembers}
                  onSaveSettings={async (settings) => {
                    console.log("Saving settings:", settings);
                    // Will connect to Django backend
                  }}
                  onUpdateMemberRole={async (memberId, role) => {
                    console.log(`Updating member ${memberId} role to ${role}`);
                    // Will connect to Django backend
                  }}
                  onBlockMember={async (memberId) => {
                    console.log(`Blocking member ${memberId}`);
                    // Will connect to Django backend
                  }}
                  onUnblockMember={async (memberId) => {
                    console.log(`Unblocking member ${memberId}`);
                    // Will connect to Django backend
                  }}
                  onRemoveMember={async (memberId) => {
                    console.log(`Removing member ${memberId}`);
                    // Will connect to Django backend
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
          setUserProfile(profile);
          console.log("Saving profile:", profile);
          // Will connect to Django backend
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
