"use client";

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import Image from "next/image";
import { getSession } from "@/lib/auth/client";
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
  clearConversationHistory,
  leaveConversation,
  markConversationRead,
  setConversationArchived,
  setConversationMuted,
  conversationMode,
  normalizeConversationPayload,
  normalizeParticipant,
  removeConversationMember,
  respondToJoinRequest,
  sendConversationMessage,
  updateGroupSettings,
  updateMemberRole,
  type Conversation,
  type ConversationAttachment,
  type ConversationMode,
  type ConversationMessage,
  type ConversationParticipant,
  type GroupSettings,
} from "@/lib/chat/conversations";
import { fetchBillingSummary, type BillingSummary } from "@/lib/billing";
import { CreateLoopModal } from "./CreateLoopModal";
import { JoinLoopModal } from "./JoinLoopModal";
import { AddMembersModal } from "./AddMembersModal";
import { LoopAdminPanel, type AdminTab } from "./LoopAdminPanel";
import { NotificationBadge } from "./NotificationBadge";
import { VerifyPhoneModal } from "./VerifyPhoneModal";
import {
  composePreview,
  conversationTimeLabel,
  dayLabel,
  describeMessageBody,
} from "@/lib/chat/preview";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { ChatAvatar } from "./ChatAvatar";
import { JoinGroupPanel } from "./JoinGroupPanel";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  LogOut,
  Trash2,
  Check,
  CheckCheck,
  ChevronLeft,
  EllipsisVertical,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";

type Message = {
  id: string | number;
  sender: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  text: string;
  mine: boolean;
  time: string;
  // Kept alongside the formatted `time` because the day separators and the
  // run-grouping both need to compare real instants, not display strings.
  createdAt: string;
  attachments?: ConversationMessage["attachments"];
};

type WebSocketMessage = {
  type: string;
  message?: Record<string, unknown>;
  [key: string]: unknown;
};

// Initialize with empty list - user creates loops as needed
const defaultConversations: Conversation[] = [];
// Shared so that "nobody is typing" is the same object every render, and the
// memo that reads it does not invalidate on each pass.
const EMPTY_TYPING_USERS: Map<string, number> = new Map();
// A run is the same person talking without a long pause. Messages inside one
// drop the avatar and the name, which is what stops a busy group reading as a
// wall of repeated headers.
const RUN_GAP_MS = 5 * 60 * 1000;
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

type HomeShellProps = {
  // Which Loops this instance lists: /chats/ shows chat groups, /broadcast/
  // shows broadcast groups. The panels and composer are otherwise identical.
  mode: ConversationMode;
};

export function HomeShell({ mode }: HomeShellProps) {
  const currentUsername = getSession();
  // The conversation list lives in the (app) layout's provider so it survives
  // navigating to another destination and back.
  const {
    conversations,
    setConversations,
    createLoopRequest,
    socketStatus,
    sendSocketMessage,
    subscribeToSocket,
    conversationToOpen,
    clearConversationToOpen,
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,
  } = useAppShell();
  const isBroadcast = mode === "broadcast";
  // Everything the list renders is scoped to this mode; the selected
  // conversation is still looked up in the full set (see selectedConversation)
  // so an open panel survives a Loop switching modes underneath it.
  const conversationsInMode = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversationMode(conversation) === mode && !conversation.cleared,
      ),
    [conversations, mode],
  );
  // The main list. Archived Loops are still members, still delivered to, and
  // still counted - just not here.
  const visibleConversations = useMemo(
    () => conversationsInMode.filter((conversation) => !conversation.archived),
    [conversationsInMode],
  );
  const archivedConversations = useMemo(
    () => conversationsInMode.filter((conversation) => conversation.archived),
    [conversationsInMode],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<
    "all" | "unread" | "groups" | "archived"
  >("all");

  const archivedUnread = archivedConversations.reduce(
    (sum, conversation) => sum + (conversation.unread || 0),
    0,
  );

  // What the list actually renders. Archived is a filter rather than a drawer
  // below the list, so the four chips are one control answering one question.
  const listedConversations = useMemo(() => {
    const base =
      listFilter === "archived"
        ? archivedConversations
        : listFilter === "unread"
          ? visibleConversations.filter(
              (conversation) => (conversation.unread || 0) > 0,
            )
          : listFilter === "groups"
            ? visibleConversations.filter(
                (conversation) => conversation.kind === "group",
              )
            : visibleConversations;

    // Searching narrows the list you already have rather than asking the
    // server: these are your own conversations and they are all in memory, so
    // a request would only add latency to something that can be instant.
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((conversation) =>
      conversation.name.toLowerCase().includes(query),
    );
  }, [listFilter, visibleConversations, archivedConversations, searchQuery]);
  // Which row's overflow menu is open, if any.
  const [rowMenuFor, setRowMenuFor] = useState<string | number | null>(null);
  // Leaving and deleting are not undoable, so the menu asks first rather than
  // acting on the click that opened it.
  const [rowConfirm, setRowConfirm] = useState<"leave" | "clear" | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | number | null
  >(defaultConversations.length > 0 ? defaultConversations[0].id : null);
  // The last open-request this instance has acted on, so one request opens a
  // Loop once rather than every render.
  const [handledOpenRequest, setHandledOpenRequest] = useState<
    string | number | null
  >(null);
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
  const [pendingConversation, setPendingConversation] =
    useState<Conversation | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const [isJoiningPending, setIsJoiningPending] = useState(false);
  const [pendingJoinError, setPendingJoinError] = useState("");
  const [pendingJoinRequestSent, setPendingJoinRequestSent] = useState(false);
  const [isLoopMenuOpen, setIsLoopMenuOpen] = useState(false);
  const [isSelectChatsMode, setIsSelectChatsMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string | number>>(
    new Set(),
  );
  const [isVerifyPhoneOpen, setIsVerifyPhoneOpen] = useState(false);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null,
  );
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLimitError, setBillingLimitError] = useState<string | null>(
    null,
  );

  // The provider fetches the list; select the first Loop of this mode once it
  // arrives. Keyed on the filtered list so /broadcast/ never opens a chat Loop.
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (hasAutoSelected.current || visibleConversations.length === 0) return;
    hasAutoSelected.current = true;
    setSelectedConversationId(visibleConversations[0].id);
  }, [visibleConversations]);

  // Gate actions that need a verified phone (Create Loop, etc.) behind the modal.
  const requirePhoneVerified = useCallback((action: () => void) => {
    // Check if the user's phone is verified before performing the action.
    // if (phoneVerified) {
    action();
    //   return;
    // }

    // setIsVerifyPhoneOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchBillingSummary().then((summaryResult) => {
      if (cancelled) return;
      if (!summaryResult.ok) {
        setBillingError(summaryResult.message);
        return;
      }

      setBillingSummary(summaryResult.data);
      setBillingError(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePlan = billingSummary?.subscription.plan ?? null;

  const ownedGroupCount = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.kind === "group" &&
          ((currentUsername &&
            conversation.createdByUsername === currentUsername) ||
            (!conversation.createdByUsername && conversation.isAdmin)),
      ).length,
    [conversations, currentUsername],
  );

  const maxGroups = activePlan?.maxGroups ?? null;
  const maxMembersPerGroup = activePlan?.maxMembersPerGroup ?? null;
  const selectedConversationForLimits = selectedConversationId
    ? conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      )
    : null;

  const isCreateLoopBlocked =
    typeof maxGroups === "number" && ownedGroupCount >= maxGroups;

  const isAddMembersBlocked =
    !!selectedConversationForLimits &&
    typeof maxMembersPerGroup === "number" &&
    selectedConversationForLimits.participants.length >= maxMembersPerGroup;

  const handleOpenCreateLoop = useCallback(() => {
    if (isCreateLoopBlocked) {
      setBillingLimitError(
        `You have reached your ${activePlan?.name ?? "current"} plan limit of ${maxGroups} groups. Upgrade your plan to create more groups.`,
      );
      return;
    }
    setBillingLimitError(null);
    requirePhoneVerified(() => setIsCreateLoopOpen(true));
  }, [isCreateLoopBlocked, activePlan?.name, maxGroups, requirePhoneVerified]);

  const handleOpenAddMembers = useCallback(() => {
    if (!selectedConversationForLimits) return;
    if (isAddMembersBlocked) {
      setBillingLimitError(
        `This group has reached your ${activePlan?.name ?? "current"} plan limit of ${maxMembersPerGroup} members per group. Upgrade your plan to add more members.`,
      );
      return;
    }
    setBillingLimitError(null);
    setIsAddMembersOpen(true);
  }, [
    selectedConversationForLimits,
    isAddMembersBlocked,
    activePlan?.name,
    maxMembersPerGroup,
  ]);

  // "Create group" in the nav rail routes here and bumps this counter.
  useEffect(() => {
    if (createLoopRequest === 0) return;
    const timer = window.setTimeout(() => {
      handleOpenCreateLoop();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [createLoopRequest, handleOpenCreateLoop]);

  // Store messages per loop
  const [loopMessages, setLoopMessages] = useState<
    Map<string | number, Message[]>
  >(new Map());
  // The scroll container, so a prepend of older history can pin the reader in
  // place instead of shunting them down the thread.
  const messageListRef = useRef<HTMLDivElement | null>(null);
  // Whether the thread should follow new messages down. True while the reader
  // is at (or near) the bottom; false the moment they scroll up to read back,
  // so an arriving message never yanks them away from what they were reading.
  const stickToBottomRef = useRef(true);
  // Set for the one render where older history is prepended: that update grows
  // the list from the TOP and has its own scroll restoration, so the follow
  // below must sit it out.
  const isPrependingRef = useRef(false);
  // A mirror of loopMessages for the reconnect handler to read. Depending on
  // the state directly would re-run that effect on every single message.
  const loopMessagesRef = useRef(loopMessages);
  useEffect(() => {
    loopMessagesRef.current = loopMessages;
  }, [loopMessages]);

  // Store WebSocket status per loop
  // Who is typing, and how far back the history has been paged: both belong
  // to ONE Loop. Each carries the id it describes so that switching Loops
  // makes it stale by definition, and is read back as empty - no reset effect,
  // and no window where the previous Loop's state applies to the new one.
  const [typingState, setTypingState] = useState<{
    conversationId: string | number | null;
    // Account id -> time of that person's last keystroke. The server sends a
    // `typing` frame per keystroke and never a "stopped", so entries are aged
    // out locally.
    users: Map<string, number>;
  }>({ conversationId: null, users: EMPTY_TYPING_USERS });
  const [historyState, setHistoryState] = useState<{
    conversationId: string | number | null;
    page: number;
    hasMore: boolean;
  }>({ conversationId: null, page: 1, hasMore: false });
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

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
        senderAvatarUrl: message.senderAvatarUrl,
        createdAt: message.createdAt,
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
  // Another screen asked for a specific Loop - Activity's "Open group". Acted
  // on during render rather than in an effect, which is what React prescribes
  // for adjusting state when an input changes, and waits for the list so a
  // request that arrives first is not dropped.
  if (
    conversationToOpen !== null &&
    conversationToOpen !== handledOpenRequest &&
    conversations.some(
      (conversation) => String(conversation.id) === String(conversationToOpen),
    )
  ) {
    setHandledOpenRequest(conversationToOpen);
    hasAutoSelected.current = true;
    setSelectedConversationId(conversationToOpen);
  }

  const isHistoryStateCurrent =
    historyState.conversationId === selectedConversationId;
  const historyPage = isHistoryStateCurrent ? historyState.page : 1;
  const hasMoreHistory = isHistoryStateCurrent ? historyState.hasMore : false;
  const typingUserIds =
    typingState.conversationId === selectedConversationId
      ? typingState.users
      : EMPTY_TYPING_USERS;
  const isSelectedConversationAdmin = selectedConversation?.isAdmin === true;
  const canAddMembers =
    isSelectedConversationAdmin ||
    groupSettings?.add_member_permission !== "admins";
  const canEditGroupSettings =
    isSelectedConversationAdmin ||
    groupSettings?.edit_group_permission !== "admins";

  // Get messages for selected loop
  // 120px of slack: "near enough the bottom" should survive a part-scrolled
  // last message, otherwise following stops the moment anything is clipped.
  const BOTTOM_SLACK_PX = 120;

  // Ask for the next page as the end comes into view rather than exactly at
  // the bottom, so the rows are usually there before the reader arrives.
  const handleChatListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!hasMoreConversations || isLoadingMoreConversations) return;
      // A filter or a search shows a subset of what is loaded, so reaching the
      // end of it says nothing about whether the server has more.
      if (searchQuery.trim() || listFilter !== "all") return;

      const node = event.currentTarget;
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (remaining < 320) loadMoreConversations();
    },
    [
      hasMoreConversations,
      isLoadingMoreConversations,
      loadMoreConversations,
      searchQuery,
      listFilter,
    ],
  );

  const handleMessageListScroll = useCallback(() => {
    const node = messageListRef.current;
    if (!node) return;
    stickToBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_SLACK_PX;
  }, []);

  // Memoized so the follow-to-bottom effect below keys off the message list
  // actually changing, not off a fresh array on every render.
  const currentMessages = useMemo(
    () =>
      selectedConversationId
        ? (loopMessages.get(selectedConversationId) ?? [])
        : [],
    [loopMessages, selectedConversationId],
  );

  const thread = useMemo(() => {
    const rows: (
      | { kind: "day"; key: string; label: string }
      | { kind: "message"; key: string; message: Message; startsRun: boolean }
    )[] = [];

    let previous: Message | null = null;
    for (const message of currentMessages) {
      const day = dayLabel(message.createdAt);
      const previousDay = previous ? dayLabel(previous.createdAt) : null;

      if (day && day !== previousDay) {
        rows.push({ kind: "day", key: `day-${day}-${message.id}`, label: day });
      }

      const sameSender =
        previous !== null &&
        previous.mine === message.mine &&
        previous.sender === message.sender;
      const closeInTime =
        previous !== null &&
        Math.abs(
          new Date(message.createdAt).getTime() -
            new Date(previous.createdAt).getTime(),
        ) < RUN_GAP_MS;

      rows.push({
        kind: "message",
        key: String(message.id),
        message,
        startsRun: !(sameSender && closeInTime && day === previousDay),
      });
      previous = message;
    }

    return rows;
  }, [currentMessages]);

  // Opening a Loop lands at the newest message, and re-arms following.
  useLayoutEffect(() => {
    stickToBottomRef.current = true;
    const node = messageListRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [selectedConversationId]);

  // Follow the thread down as messages arrive - but only while the reader is
  // already at the bottom. useLayoutEffect so the jump happens in the same
  // frame the message paints, rather than as a visible lurch afterwards.
  useLayoutEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }
    if (!stickToBottomRef.current) return;
    const node = messageListRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [currentMessages]);

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
  }, [selectedConversationId, currentUsername, setConversations]);

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
      setHistoryState({
        conversationId: selectedConversationId,
        page: 1,
        hasMore: result.hasMore,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, toUiMessage]);

  /**
   * Fetch the page of history before the oldest message on screen.
   *
   * History comes back newest-first in pages of twenty, so "older" is simply
   * the next page number, and its contents belong ABOVE what is already
   * rendered. The scroll position is pinned by measuring the container's
   * scrollHeight before and after the prepend and re-applying the difference -
   * without that, adding content above the viewport shunts the reader down
   * the thread and away from where they were reading.
   */
  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedConversationId || isLoadingOlder || !hasMoreHistory) return;

    const container = messageListRef.current;
    const heightBefore = container?.scrollHeight ?? 0;
    const scrollBefore = container?.scrollTop ?? 0;

    setIsLoadingOlder(true);
    const nextPage = historyPage + 1;
    const result = await fetchMessageHistory(selectedConversationId, {
      page: nextPage,
    });
    setIsLoadingOlder(false);

    if (!result.ok) {
      setMessageError(result.message);
      return;
    }

    const older = result.messages.map(toUiMessage);
    isPrependingRef.current = true;
    setLoopMessages((previous) => {
      const next = new Map(previous);
      const current = next.get(selectedConversationId) ?? [];
      // Guard against a page arriving twice - a duplicated id would break
      // React's keys as well as showing the message twice.
      const known = new Set(current.map((message) => String(message.id)));
      const fresh = older.filter((message) => !known.has(String(message.id)));
      next.set(selectedConversationId, [...fresh, ...current]);
      return next;
    });
    setHistoryState({
      conversationId: selectedConversationId,
      page: nextPage,
      hasMore: result.hasMore,
    });

    // After paint, restore the reader to the same message.
    requestAnimationFrame(() => {
      const node = messageListRef.current;
      if (!node) return;
      node.scrollTop = scrollBefore + (node.scrollHeight - heightBefore);
    });
  }, [
    selectedConversationId,
    isLoadingOlder,
    hasMoreHistory,
    historyPage,
    toUiMessage,
  ]);

  /**
   * After a dropped socket, fetch only what was missed.
   *
   * The server exposes an `after_id` resume cursor for exactly this. Without
   * it a reconnect either refetches the whole newest page or, worse, silently
   * leaves a hole where the messages that arrived while offline should be.
   */
  const wasSocketConnected = useRef(false);
  useEffect(() => {
    const isConnected = socketStatus === "connected";
    const reconnected = isConnected && wasSocketConnected.current === false;
    wasSocketConnected.current = isConnected;

    if (!reconnected || !selectedConversationId) return;

    const known = loopMessagesRef.current.get(selectedConversationId) ?? [];
    const newest = known[known.length - 1];
    if (!newest) return;

    let cancelled = false;

    // The cursor endpoint paginates like any other, so one call recovers at
    // most a page. Walk it until the server says there is no more, or a long
    // disconnect leaves a silent hole in the thread. Capped so a bug upstream
    // cannot turn this into an unbounded fetch loop.
    const MAX_CATCH_UP_PAGES = 10;

    (async () => {
      let cursor: string | number = newest.id;

      for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const result = await fetchMessageHistory(selectedConversationId, {
          afterId: cursor,
        });
        if (cancelled || !result.ok || result.messages.length === 0) return;

        const batch = result.messages;
        setLoopMessages((previous) => {
          const next = new Map(previous);
          const current = next.get(selectedConversationId) ?? [];
          const seen = new Set(current.map((message) => String(message.id)));
          const missed = batch
            .map(toUiMessage)
            .filter((message) => !seen.has(String(message.id)));
          if (missed.length === 0) return previous;
          next.set(selectedConversationId, [...current, ...missed]);
          return next;
        });

        if (!result.hasMore) return;
        cursor = batch[batch.length - 1].id;
      }

      console.warn(
        `[chat] stopped catching up conversation ${selectedConversationId} after ${MAX_CATCH_UP_PAGES} pages; older gaps may remain`,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [socketStatus, selectedConversationId, toUiMessage]);

  /**
   * Fold a changed conversation back into the list the sidebar renders.
   *
   * A merge rather than a replacement: the detail payload carries no
   * participants (they live on their own paginated endpoint), so overwriting
   * wholesale would empty the member list and the count that reads it.
   */
  const applyConversationUpdate = useCallback(
    (updated: Conversation) => {
      setConversations((prev) =>
        prev.map((existing) =>
          String(existing.id) === String(updated.id)
            ? {
                ...existing,
                ...updated,
                participants: updated.participants.length
                  ? updated.participants
                  : existing.participants,
              }
            : existing,
        ),
      );
    },
    [setConversations],
  );

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
                  // The same composer the fetched path runs, so a live
                  // message reads exactly like the same message reloaded.
                  preview: composePreview(
                    newMessage.sender,
                    describeMessageBody(
                      newMessage.text,
                      newMessage.attachments ?? [],
                    ),
                  ),
                  lastMessageAt: String(
                    rawMessage.created_at ?? new Date().toISOString(),
                  ),
                  unread: isForSelectedConversation ? 0 : (c.unread || 0) + 1,
                }
              : c,
          ),
        );

        // Arriving in the thread that is open, in a tab the user is actually
        // looking at, means they have read it. Guarded on focus: a background
        // tab would otherwise mark messages read that nobody has seen, on
        // every device at once.
        if (
          isForSelectedConversation &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible" &&
          document.hasFocus()
        ) {
          void markConversationRead(targetConversationId, newMessage.id);
        }
      } else if (message.type === "conversation.read.by") {
        // Somebody else read up to a message. Their pointer lives on the
        // membership row, which is what the receipts below are computed from.
        const conversationId = message.conversation_id;
        const readerId = message.user_id;
        const upTo = message.last_read_message_id;
        if (
          typeof readerId === "number" &&
          typeof upTo === "number" &&
          conversationId !== undefined
        ) {
          setConversations((prev) =>
            prev.map((c) =>
              String(c.id) === String(conversationId)
                ? {
                    ...c,
                    participants: c.participants.map((participant) =>
                      participant.userId === String(readerId)
                        ? { ...participant, lastReadMessageId: upTo }
                        : participant,
                    ),
                  }
                : c,
            ),
          );
        }
      } else if (message.type === "conversation.read") {
        // This account read the Loop somewhere else - another tab, the phone.
        // Only ever arrives on the user's own channel, so it says nothing
        // about anybody else in the conversation.
        const conversationId = message.conversation_id;
        if (
          typeof conversationId === "string" ||
          typeof conversationId === "number"
        ) {
          setConversations((prev) =>
            prev.map((c) =>
              String(c.id) === String(conversationId) ? { ...c, unread: 0 } : c,
            ),
          );
        }
      } else if (message.type === "typing") {
        // Only for the Loop on screen, and only from other people - the
        // server already suppresses the echo to the sender.
        const isForSelected =
          String(message.conversation_id) === String(selectedConversationId);
        const userId = message.user_id;
        if (
          isForSelected &&
          (typeof userId === "string" || typeof userId === "number")
        ) {
          setTypingState((prev) => {
            const users =
              prev.conversationId === selectedConversationId
                ? new Map(prev.users)
                : new Map<string, number>();
            users.set(String(userId), performance.now());
            return { conversationId: selectedConversationId, users };
          });
        }
      } else if (message.type === "conversation.updated") {
        // Settings changed - possibly `mode`, which decides whether this group
        // belongs under Chat or Broadcast. Applied from the payload rather than
        // refetched so the group moves the moment the admin saves.
        const updated = normalizeConversationPayload(message.conversation);
        if (updated) applyConversationUpdate(updated);
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
    [
      applyConversationUpdate,
      currentUsername,
      selectedConversationId,
      toUiMessage,
      setConversations,
    ],
  );

  // Route the shared socket's frames into this component. The provider fans
  // out to a listener set, so re-subscribing when the handler's identity
  // changes costs nothing and never disturbs the connection itself.
  useEffect(
    () => subscribeToSocket(handleWebSocketMessage),
    [subscribeToSocket, handleWebSocketMessage],
  );

  // A `typing` frame arrives per keystroke and there is no "stopped" event,
  // so a name would otherwise stick forever. Expire entries a few seconds
  // after the last keystroke.
  useEffect(() => {
    if (typingUserIds.size === 0) return;
    const timer = window.setInterval(() => {
      setTypingState((prev) => {
        const cutoff = performance.now() - 5000;
        let changed = false;
        const users = new Map(prev.users);
        for (const [userId, at] of users) {
          if (at < cutoff) {
            users.delete(userId);
            changed = true;
          }
        }
        return changed ? { ...prev, users } : prev;
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [typingUserIds.size]);

  // One frame at most every couple of seconds while the user keeps typing.
  // The server fans each one out to every member of the group, so sending per
  // keystroke would put a message on every other client's socket per letter.
  const lastTypingSentAt = useRef(0);
  const notifyTyping = useCallback(() => {
    if (!selectedConversationId || socketStatus !== "connected") return;
    const now = performance.now();
    if (now - lastTypingSentAt.current < 2000) return;
    lastTypingSentAt.current = now;
    sendSocketMessage({
      type: "typing",
      conversation_id: selectedConversationId,
    });
  }, [selectedConversationId, socketStatus, sendSocketMessage]);

  const handleSendMessage = useCallback(async () => {
    if (
      (!messageInput.trim() && messageAttachments.length === 0) ||
      !selectedConversationId ||
      isSendingMessage
    )
      return;
    // Sending is an explicit "I am at the end of this thread" gesture, so
    // follow the message down even if the reader had scrolled up.
    stickToBottomRef.current = true;
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
    clearConversationToOpen();
    setHandledOpenRequest(null);
    setPendingConversation(null);
    setSelectedConversationId(conversationId);
    // Clear the badge here AND on the server. The local zero below is
    // optimistic so the badge goes immediately; this is what makes it stay
    // gone after a reload, and clears it on the user's other devices.
    void markConversationRead(conversationId);
    setConversations(
      conversations.map((c) => ({
        ...c,
        active: c.id === conversationId,
        unread: c.id === conversationId ? 0 : c.unread,
      })),
    );
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
    const isSelectedForBatch = selectedChatIds.has(conversation.id);
    // Keyed on the id that actually drives the panel rather than the `active`
    // flag: that flag is seeded as index 0 of ALL conversations, so on
    // /broadcast/ it can mark a row that is not the one open.
    const isOpen = String(conversation.id) === String(selectedConversationId);
    const isUnread = (conversation.unread || 0) > 0;

    // Four states, and the two axes are independent: a row can be open, or
    // unread, or both. Dark mode keeps the same ordering - each step up in
    // emphasis is a step up in blue - rather than reusing the light hexes,
    // which would all read as near-white on a dark ground.
    const rowTone = isOpen
      ? isUnread
        ? "border-sky-400 bg-[#DDF0FF] text-slate-900 dark:border-sky-500 dark:bg-sky-900/50 dark:text-slate-100"
        : "border-sky-400 bg-[#E4F3FF] text-slate-900 dark:border-sky-500 dark:bg-sky-900/40 dark:text-slate-100"
      : isUnread
        ? "border-transparent bg-[#F2F8FF] text-slate-900 hover:bg-[#F7FAFC] dark:bg-sky-950/40 dark:text-slate-100 dark:hover:bg-slate-700"
        : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-[#F7FAFC] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

    const isMenuOpen = rowMenuFor === conversation.id;

    return (
      <div key={conversation.id} className="group/row relative">
        <button
          type="button"
          onClick={() => {
            if (isSelectChatsMode) {
              toggleChatSelection(conversation.id);
              return;
            }
            handleSelectConversation(conversation.id);
          }}
          className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${rowTone}`}
        >
          {/* The right padding is a lane for the row menu, which is absolutely
              positioned so appearing on hover cannot reflow the row. Without it
              the menu button lands on top of the unread badge. */}
          <div className="flex items-center gap-3 pr-7">
            {isSelectChatsMode && (
              <span
                className={`h-4 w-4 shrink-0 rounded border ${
                  isSelectedForBatch
                    ? "border-sky-600 bg-sky-600"
                    : "border-slate-300 bg-white"
                }`}
              />
            )}

            <ChatAvatar
              name={conversation.name}
              imageUrl={conversation.logoImage}
              isGroup={conversation.kind === "group"}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={`truncate text-sm ${isUnread ? "font-bold" : "font-semibold"}`}
                >
                  {conversation?.name}
                </p>
                {conversation.kind === "group" && conversation.isAdmin && (
                  <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
                    Admin
                  </span>
                )}
              </div>
              <p
                className={`mt-0.5 truncate text-xs ${
                  isOpen
                    ? "text-sky-700 dark:text-sky-300"
                    : isUnread
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {conversation.preview}
              </p>
            </div>

            {/* Time above, badge below - so neither competes with the name for
                width, and a long group name truncates far later. */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] leading-none text-slate-400 dark:text-slate-500">
                {conversationTimeLabel(conversation.lastMessageAt)}
              </span>
              <span className="flex items-center gap-1.5">
                {conversation.muted && (
                  <BellOff
                    className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                    aria-label="Muted"
                  />
                )}
                <NotificationBadge count={conversation.unread} />
              </span>
            </div>
          </div>
        </button>

        {/* Outside the row button: a button nested in a button is invalid
            markup, and the inner one stops receiving clicks. */}
        {!isSelectChatsMode && (
          <button
            type="button"
            aria-label="Chat options"
            onClick={() => {
              if (isMenuOpen) {
                closeRowMenu();
                return;
              }
              setRowConfirm(null);
              setRowActionError(null);
              setRowMenuFor(conversation.id);
            }}
            className={`absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/70 focus:opacity-100 group-hover/row:opacity-100 dark:text-slate-400 dark:hover:bg-slate-900/60 ${
              isMenuOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
        )}

        {isMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeRowMenu}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div className="absolute top-full right-2 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <button
                type="button"
                onClick={() => void handleToggleMuted(conversation)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {conversation.muted ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
                {conversation.muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={() => void handleToggleArchived(conversation)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {conversation.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {conversation.archived ? "Unarchive" : "Archive"}
              </button>
              {/* Says the thing people get wrong about these two. */}
              <p className="px-3 pt-1.5 pb-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                {conversation.muted
                  ? "Muted, so texts are paused too."
                  : "Archiving still delivers texts."}
              </p>

              {/* Leaving and deleting are refused on a one-to-one - there is
                  no way back into one - so they are not offered there. */}
              <>
                <div className="my-1 border-t border-slate-200 dark:border-slate-700" />

                {rowConfirm === null ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRowConfirm("clear")}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete chat
                    </button>
                    {/* Leaving is refused on a one-to-one - there is no way
                        back into one - so it is not offered there. */}
                    {conversation.kind === "group" && (
                      <button
                        type="button"
                        onClick={() => setRowConfirm("leave")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <LogOut className="h-4 w-4" />
                        Leave group
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {rowConfirm === "leave"
                        ? `Leave ${conversation.name}?`
                        : `Delete ${conversation.name}?`}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {rowConfirm === "leave"
                        ? "You stop receiving it. Your messages stay in the group."
                        : "Clears it for you only. You stay in the group, and it comes back if somebody posts - with just the new messages."}
                    </p>

                    {rowActionError && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                        {rowActionError}
                      </p>
                    )}

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRowConfirm(null);
                          setRowActionError(null);
                        }}
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void (rowConfirm === "leave"
                            ? handleLeaveRow(conversation)
                            : handleClearRow(conversation))
                        }
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-white ${
                          rowConfirm === "leave"
                            ? "bg-slate-700 hover:bg-slate-800"
                            : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        {rowConfirm === "leave" ? "Leave" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            </div>
          </>
        )}
      </div>
    );
  }

  // Everything below counts only the Loops this list shows. Scoped to the
  // mode, or the Chats badge would total broadcast unreads and the Invites
  // worklist could jump to a Loop that is not in this list at all.
  const loopsWithPendingRequests = visibleConversations.filter(
    (conversation) =>
      (pendingRequestsByLoop.get(conversation.id)?.length ?? 0) > 0,
  );
  // Requests nobody has looked at yet - drives the Invites badge specifically.
  const totalUnseenInvites = visibleConversations.reduce(
    (sum, conversation) =>
      sum + (unseenRequestCountByLoop.get(conversation.id) ?? 0),
    0,
  );

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

  function handleMarkAllRead() {
    // Tell the server about each Loop that actually has something unread,
    // otherwise this only cleared the badges until the next reload.
    for (const conversation of visibleConversations) {
      if (conversation.unread > 0) {
        void markConversationRead(conversation.id);
      }
    }
    setConversations((current) =>
      current.map((conversation) =>
        conversationMode(conversation) === mode
          ? { ...conversation, unread: 0 }
          : conversation,
      ),
    );
    setUnseenRequestCountByLoop((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        next.set(key, 0);
      }
      return next;
    });
    setIsLoopMenuOpen(false);
  }

  async function handleToggleArchived(conversation: Conversation) {
    closeRowMenu();
    const next = !conversation.archived;
    // Optimistic: the row leaves the list at once, and the request only
    // corrects it if the server disagrees.
    setConversations((current) =>
      current.map((row) =>
        row.id === conversation.id ? { ...row, archived: next } : row,
      ),
    );
    if (next && conversation.id === selectedConversationId) {
      setSelectedConversationId(null);
    }
    const result = await setConversationArchived(conversation.id, next);
    if (!result.ok) {
      setConversations((current) =>
        current.map((row) =>
          row.id === conversation.id ? { ...row, archived: !next } : row,
        ),
      );
    }
  }

  function closeRowMenu() {
    setRowMenuFor(null);
    setRowConfirm(null);
    setRowActionError(null);
  }

  function dropConversation(conversationId: string | number) {
    setConversations((current) =>
      current.filter((row) => row.id !== conversationId),
    );
    setSelectedConversationId((current) =>
      current === conversationId ? null : current,
    );
  }

  async function handleLeaveRow(conversation: Conversation) {
    const result = await leaveConversation(conversation.id);
    if (!result.ok) {
      // The server refuses the last admin, and says why - that message is
      // more use than anything this component could invent.
      setRowActionError(result.message);
      return;
    }
    closeRowMenu();
    dropConversation(conversation.id);
  }

  async function handleClearRow(conversation: Conversation) {
    const result = await clearConversationHistory(conversation.id);
    if (!result.ok) {
      setRowActionError(result.message);
      return;
    }
    closeRowMenu();
    // Cleared, so there is nothing left to show and it leaves the list. The
    // membership is untouched - the server sends it back the moment somebody
    // posts, and `cleared` flips false again.
    setConversations((current) =>
      current.map((row) =>
        row.id === conversation.id
          ? { ...row, cleared: true, unread: 0, preview: "" }
          : row,
      ),
    );
    setSelectedConversationId((current) =>
      current === conversation.id ? null : current,
    );
  }

  async function handleToggleMuted(conversation: Conversation) {
    closeRowMenu();
    const next = !conversation.muted;
    setConversations((current) =>
      current.map((row) =>
        row.id === conversation.id ? { ...row, muted: next } : row,
      ),
    );
    const result = await setConversationMuted(conversation.id, next);
    if (!result.ok) {
      setConversations((current) =>
        current.map((row) =>
          row.id === conversation.id ? { ...row, muted: !next } : row,
        ),
      );
    }
  }

  function handleToggleSelectChatsMode() {
    setIsSelectChatsMode((current) => !current);
    setSelectedChatIds(new Set());
    setIsLoopMenuOpen(false);
  }

  function toggleChatSelection(conversationId: string | number) {
    setSelectedChatIds((current) => {
      const next = new Set(current);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }

  // Broadcast groups take posts from admins only. Read through the helper:
  // the list endpoint leaves the top-level `mode` at its "chat" default, so
  // `selectedConversation.mode` alone would let anyone post anywhere.
  /**
   * Who could possibly read a message, and how many of them have.
   *
   * Counts only members with an account. A phone-only member receives by SMS,
   * and SMS can report that a handset accepted a text but never that a person
   * read it - so counting them would assert something nobody knows. They are
   * left out of the denominator for the same reason.
   */
  const readableBy = useMemo(
    () =>
      (selectedConversation?.participants ?? []).filter(
        (participant) =>
          participant.userId && participant.username !== currentUsername,
      ),
    [selectedConversation, currentUsername],
  );

  const lastOwnMessageId = useMemo(() => {
    for (let i = currentMessages.length - 1; i >= 0; i -= 1) {
      if (currentMessages[i].mine) return currentMessages[i].id;
    }
    return null;
  }, [currentMessages]);

  const readersOf = useCallback(
    (messageId: string | number) => {
      const id = Number(messageId);
      if (!Number.isFinite(id)) return 0;
      return readableBy.filter(
        (participant) => (participant.lastReadMessageId ?? 0) >= id,
      ).length;
    },
    [readableBy],
  );

  // Typing frames carry an account id; the membership rows carry the names.
  // Members load on their own request, so a frame can arrive before the name
  // for it exists - in which case say SOMETHING rather than nothing, or the
  // indicator silently disappears exactly when the thread is most active.
  const typingNames = useMemo(() => {
    if (typingUserIds.size === 0) return [];
    const byUserId = new Map(
      (selectedConversation?.participants ?? [])
        .filter((participant) => participant.userId)
        .map((participant) => [participant.userId as string, participant.name]),
    );
    return Array.from(typingUserIds.keys()).map(
      (userId) => byUserId.get(userId) ?? "",
    );
  }, [typingUserIds, selectedConversation]);

  const namedTyping = typingNames.filter(Boolean);
  const typingLabel =
    typingNames.length === 0
      ? ""
      : namedTyping.length === 0
        ? typingNames.length === 1
          ? "Someone is typing..."
          : "Several people are typing..."
        : namedTyping.length === 1 && typingNames.length === 1
          ? `${namedTyping[0]} is typing...`
          : namedTyping.length === 2 && typingNames.length === 2
            ? `${namedTyping[0]} and ${namedTyping[1]} are typing...`
            : "Several people are typing...";

  const canPostMessage =
    !selectedConversation ||
    conversationMode(selectedConversation) !== "broadcast" ||
    selectedConversation.isAdmin;
  const showConversationPanelOnMobile = Boolean(
    selectedConversation || pendingConversation,
  );

  return (
    <>
      <div className="grid h-full min-h-0 w-full overflow-hidden md:grid-cols-[340px_1fr]">
        <aside
          className={`${showConversationPanelOnMobile ? "hidden md:flex" : "flex"} min-h-0 flex-col border-b border-slate-200 bg-[#f7f9fb] md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="border-b border-slate-200 bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-white dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <NavDrawerButton className="-ml-2 text-white hover:bg-white/20" />
                <p className="truncate text-lg font-bold">
                  {isBroadcast ? "Broadcast" : "Chats"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Create Loop"
                  onClick={handleOpenCreateLoop}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                >
                  <Plus className="h-5 w-5" />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    title="Loop menu"
                    onClick={() => setIsLoopMenuOpen((current) => !current)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                  >
                    <EllipsisVertical className="h-5 w-5" />
                  </button>

                  {isLoopMenuOpen && (
                    <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLoopMenuOpen(false);
                          handleOpenCreateLoop();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Plus className="h-4 w-4" />
                        New Loop
                      </button>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <CheckCheck className="h-4 w-4" />
                        Mark all as read
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleSelectChatsMode}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ListChecks className="h-4 w-4" />
                        {isSelectChatsMode
                          ? "Exit select chats"
                          : "Select chats"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-700">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search your chats"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </div>

          <div
            onScroll={handleChatListScroll}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          >
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

            <div className="space-y-5">
              {billingError && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  Billing info unavailable right now: {billingError}
                </p>
              )}
              {billingLimitError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {billingLimitError}
                </p>
              )}
              {activePlan && (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Plan: {activePlan.name} · Groups {ownedGroupCount}
                  {typeof maxGroups === "number" ? `/${maxGroups}` : ""}
                  {typeof maxMembersPerGroup === "number"
                    ? ` · Members per group up to ${maxMembersPerGroup}`
                    : ""}
                </p>
              )}
              {isSelectChatsMode && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  Selected chats: {selectedChatIds.size}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all", label: "All", count: 0 },
                    {
                      id: "unread",
                      label: "Unread",
                      count: visibleConversations.filter(
                        (c) => (c.unread || 0) > 0,
                      ).length,
                    },
                    { id: "groups", label: "Groups", count: 0 },
                    {
                      id: "archived",
                      label: "Archived",
                      count: archivedUnread,
                    },
                  ] as const
                ).map((chip) => {
                  // Archived only earns a chip once there is something in
                  // it; the other three are always meaningful.
                  if (
                    chip.id === "archived" &&
                    archivedConversations.length === 0
                  ) {
                    return null;
                  }
                  const active = listFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setListFilter(chip.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-[#168CFF] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {chip.id === "archived" && (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      {chip.label}
                      {chip.count > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[10px] font-bold ${
                            active
                              ? "bg-white/25 text-white"
                              : "bg-[#168CFF] text-white"
                          }`}
                        >
                          {chip.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {listedConversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {listFilter === "unread"
                      ? "Nothing unread"
                      : listFilter === "archived"
                        ? "Nothing archived"
                        : listFilter === "groups"
                          ? "No groups yet"
                          : isBroadcast
                            ? "No broadcast Loops yet"
                            : "No chats yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {listFilter === "all"
                      ? isBroadcast
                        ? "Loops set to broadcast mode appear here"
                        : "Create a loop to get started"
                      : "Try another filter."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {listedConversations.map(renderConversationButton)}
                  {isLoadingMoreConversations && (
                    <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                      Loading more...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section
          className={`${
            showConversationPanelOnMobile ? "flex" : "hidden md:flex"
          } min-h-0 min-w-0 flex-col bg-[#f3f9ff] dark:bg-slate-950`}
        >
          <header className="border-b border-slate-200 bg-[#eef7ff] px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingConversation(null);
                      setSelectedConversationId(null);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Back to chat list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg dark:text-slate-100">
                    {selectedConversation?.name ||
                      pendingConversation?.name ||
                      "Select a Loop"}
                  </h2>
                </div>
                {selectedConversationId && selectedConversation && (
                  <div className="mt-2 flex max-w-[68vw] gap-1.5 overflow-x-auto pb-1 md:max-w-[40vw]">
                    {selectedConversation.participants.map((participant) => (
                      <span
                        key={participant.id}
                        title={
                          participant.isOnline
                            ? `${participant.name} is online`
                            : participant.lastActive
                              ? `${participant.name} - last seen ${new Date(
                                  participant.lastActive,
                                ).toLocaleString()}`
                              : participant.name
                        }
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            participant.isOnline
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        {participant.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedConversationId && (
                  <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 lg:block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {selectedConversation?.participants.length ?? 0} member
                    {(selectedConversation?.participants.length ?? 0) === 1
                      ? ""
                      : "s"}
                  </div>
                )}

                {selectedConversationId && (
                  <div
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      socketStatus === "connected"
                        ? "bg-sky-100 text-sky-700"
                        : socketStatus === "connecting"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                    title={`WebSocket: ${socketStatus}`}
                  >
                    {socketStatus === "connected" && "Live"}
                    {socketStatus === "connecting" && "Connecting"}
                    {socketStatus !== "connected" &&
                      socketStatus !== "connecting" &&
                      "Offline"}
                  </div>
                )}

                {selectedConversationId && (
                  <div className="flex items-center gap-2">
                    {canAddMembers && (
                      <button
                        type="button"
                        onClick={handleOpenAddMembers}
                        title="Add members"
                        aria-label="Add members"
                        disabled={isAddMembersBlocked}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
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
            </div>
          </header>

          <div
            ref={messageListRef}
            onScroll={handleMessageListScroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4"
          >
            {selectedConversationId && hasMoreHistory && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={() => void handleLoadOlderMessages()}
                  disabled={isLoadingOlder}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {isLoadingOlder ? "Loading..." : "Load older messages"}
                </button>
              </div>
            )}
            {pendingConversation ? (
              <div className="flex h-full items-center justify-center">
                <JoinGroupPanel
                  name={pendingConversation.name}
                  description={pendingConversation.description}
                  joinMode={pendingConversation.joinMode}
                  code={pendingJoinCode}
                  onCodeChange={setPendingJoinCode}
                  onJoin={handleJoinPending}
                  onJoinWithCode={handleJoinPendingWithCode}
                  isJoining={isJoiningPending}
                  requestSent={pendingJoinRequestSent}
                  error={pendingJoinError}
                />
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
              thread.map((row) =>
                row.kind === "day" ? (
                  <div key={row.key} className="flex justify-center py-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                      {row.label}
                    </span>
                  </div>
                ) : (
                  <div
                    key={row.key}
                    className={`relative flex items-start gap-2 ${
                      row.message.mine ? "justify-end" : "justify-start"
                    } ${row.startsRun ? "mt-3" : "mt-0.5"} ${
                      row.message.mine && row.message.id === lastOwnMessageId
                        ? "mb-4"
                        : ""
                    }`}
                  >
                    {/* One avatar per run, and only for other people - your
                        own messages are already identified by their side. A
                        spacer keeps continuations aligned under the first. */}
                    {!row.message.mine &&
                      (row.startsRun ? (
                        <ChatAvatar
                          name={row.message.sender}
                          imageUrl={row.message.senderAvatarUrl}
                          size={32}
                        />
                      ) : (
                        <span aria-hidden className="w-8 shrink-0" />
                      ))}

                    <article
                      className={`max-w-xl rounded-2xl px-3 py-2 ${
                        row.message.mine
                          ? "bg-[#dff1ff] text-slate-900"
                          : "bg-white text-slate-800 shadow-[0_4px_16px_rgba(26,85,133,0.08)] dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {row.startsRun && !row.message.mine && (
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          {row.message.sender}
                        </p>
                      )}
                      <div
                        className={`flex items-end gap-2 ${
                          row.startsRun && !row.message.mine ? "mt-0.5" : ""
                        }`}
                      >
                        {row.message.text && (
                          <p className="min-w-0 text-sm leading-snug break-words">
                            {row.message.text}
                          </p>
                        )}
                        <span
                          className={`ml-auto flex shrink-0 items-center gap-1 text-[10px] leading-none ${
                            row.message.mine
                              ? "text-sky-700/70"
                              : "text-slate-400"
                          }`}
                        >
                          {row.message.time}
                          {row.message.mine &&
                            (() => {
                              // Ticks only on your own messages, and only
                              // where somebody could report reading them.
                              if (readableBy.length === 0) return null;
                              const seen = readersOf(row.message.id);
                              if (seen === 0) {
                                return (
                                  <Check
                                    className="h-3 w-3"
                                    aria-label="Sent"
                                  />
                                );
                              }
                              return (
                                <CheckCheck
                                  className={`h-3 w-3 ${
                                    seen >= readableBy.length
                                      ? "text-emerald-600"
                                      : ""
                                  }`}
                                  aria-label={`Read by ${seen}`}
                                />
                              );
                            })()}
                        </span>
                      </div>
                      {row.message.attachments &&
                        row.message.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {row.message.attachments.map((attachment) => (
                              <div key={attachment.id ?? attachment.url}>
                                {attachment.contentType?.startsWith(
                                  "audio/",
                                ) && (
                                  <audio
                                    controls
                                    src={attachment.url}
                                    className="mb-1 max-w-full"
                                  />
                                )}
                                {attachment.contentType?.startsWith(
                                  "image/",
                                ) && (
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
                                  className="block truncate text-xs text-sky-700 underline"
                                >
                                  {attachment.originalName}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                    </article>

                    {/* Spelled out once, under the newest message you sent -
                        under every one it is noise, and the ticks already say
                        it per message. */}
                    {row.message.mine &&
                      row.message.id === lastOwnMessageId &&
                      readersOf(row.message.id) > 0 && (
                        <span className="absolute -bottom-4 right-0 text-[10px] whitespace-nowrap text-slate-400 dark:text-slate-500">
                          {readersOf(row.message.id)} read {row.message.time}
                        </span>
                      )}
                  </div>
                ),
              )
            )}
          </div>

          {typingLabel && (
            <p className="shrink-0 px-4 pb-1 text-xs text-slate-500 italic dark:text-slate-400">
              {typingLabel}
            </p>
          )}

          <footer className="shrink-0 border-t border-slate-200 bg-[#eef7ff] p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
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
              <div className="relative rounded-2xl border border-slate-200 bg-[#eef7ff] p-2 shadow-[0_6px_20px_rgba(30,89,138,0.09)] dark:border-slate-700 dark:bg-slate-800">
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
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        notifyTyping();
                      }}
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
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsAdminPanelOpen(false)}
                className="sticky top-4 right-4 z-10 float-right rounded-lg bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
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
                    // The sidebar reads `settings.mode` off the conversations
                    // list, so updating only the admin panel's own state left
                    // the group filed under Chat until a reload.
                    applyConversationUpdate(result.conversation);
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
    </>
  );
}
