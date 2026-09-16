"use client";

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth/client";
import {
  addConversationMembers,
  fetchConversation,
  fetchConversationParticipants,
  fetchConversations,
  mergeConversations,
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
  hasReacted,
  normalizeConversationPayload,
  normalizeMessagePayload,
  normalizeParticipant,
  removeConversationMember,
  respondToJoinRequest,
  sendConversationMessage,
  setMessageReaction,
  setPinnedMessage,
  editConversationMessage,
  deleteConversationMessage,
  forwardConversationMessage,
  updateGroupSettings,
  updateMemberRole,
  type Conversation,
  type ConversationMode,
  type ConversationMessage,
  type ConversationParticipant,
  type GroupSettings,
} from "@/lib/chat/conversations";
import {
  createPlanCheckoutSession,
  fetchBillingPlans,
  fetchBillingSummary,
  type BillingPlan,
  type BillingSummary,
} from "@/lib/billing";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuOrigin,
} from "@/components/ui/context-menu";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import {
  ComposerContextBar,
  DeleteMessageDialog,
  ForwardMessageModal,
  MessageBubble,
  MessageInfoModal,
  PinnedMessageBar,
  ReactionBar,
  type ComposerContext,
  type ThreadMessage,
} from "./message";
import {
  canDeleteMessage,
  canEditMessage,
  canPinMessage,
  DELETED_MESSAGE_TEXT,
} from "@/lib/chat/messageActions";
import { CreateLoopModal } from "./CreateLoopModal";
import { JoinLoopModal } from "./JoinLoopModal";
import { AddMembersModal } from "./AddMembersModal";
import { LoopAdminPanel, type AdminTab } from "./LoopAdminPanel";
import { NotificationBadge } from "./NotificationBadge";
import { VerifyPhoneModal } from "./VerifyPhoneModal";
import { Button, Modal } from "@/components/ui";
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
  CheckCheck,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Pencil,
  Pin,
  PinOff,
  Info,
  ArchiveRestore,
  Bell,
  BellOff,
  LogOut,
  Trash2,
  ChevronLeft,
  EllipsisVertical,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";
import { NewConversationModal } from "./NewConversationModal";
import { useLocalMessagingPreferences } from "@/lib/user/messagingPreferences";

// One definition, owned by the component that renders it. The alias keeps the
// ~40 existing references in this file reading as they did.
type Message = ThreadMessage;

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
  const router = useRouter();
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
  // The "+" opens one dialog that holds both ways to start a conversation:
  // find a person, or make a group.
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isSelectChatsMode, setIsSelectChatsMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string | number>>(
    new Set(),
  );
  const [isVerifyPhoneOpen, setIsVerifyPhoneOpen] = useState(false);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null,
  );
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLimitError, setBillingLimitError] = useState<string | null>(
    null,
  );
  const [billingLimitModal, setBillingLimitModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [upgradeCheckoutPlanCode, setUpgradeCheckoutPlanCode] = useState<
    string | null
  >(null);
  const [upgradeCheckoutError, setUpgradeCheckoutError] = useState<
    string | null
  >(null);

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

    Promise.all([fetchBillingSummary(), fetchBillingPlans()]).then(
      ([summaryResult, plansResult]) => {
        if (cancelled) return;

        if (!summaryResult.ok) {
          setBillingError(summaryResult.message);
          return;
        }

        setBillingSummary(summaryResult.data);
        setBillingError(plansResult.ok ? null : plansResult.message);
        setBillingPlans(plansResult.ok ? plansResult.data : []);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const modalPlans = useMemo(() => {
    const rankByCode: Record<string, number> = {
      free: 0,
      premium: 1,
      business: 2,
      enterprise: 3,
    };

    const sorted = [...billingPlans].sort((a, b) => {
      const aCode = a.code.toLowerCase();
      const bCode = b.code.toLowerCase();
      if (aCode === "enterprise" && bCode !== "enterprise") return 1;
      if (bCode === "enterprise" && aCode !== "enterprise") return -1;
      const aRank = rankByCode[aCode] ?? 50;
      const bRank = rankByCode[bCode] ?? 50;
      return aRank - bRank;
    });

    return sorted.map((plan) => {
      const code = plan.code.toLowerCase();
      const summary =
        code === "free"
          ? "Good for getting started with smaller groups."
          : code === "premium"
            ? "For growing communities that need larger limits."
            : code === "business"
              ? "For larger teams with advanced operational needs."
              : code === "enterprise"
                ? "Custom package for organizations with complex requirements."
                : "Scale your plan to match your team needs.";

      return {
        code,
        name: plan.name,
        price: plan.priceDisplay,
        summary,
        features: plan.features,
      };
    });
  }, [billingPlans]);

  // The backend folds an active Enterprise contract's entitlements directly
  // into subscription.plan (code becomes the contract number, limits are the
  // real ones, features list what's enabled) - no separate Enterprise-aware
  // path needed here, this already reflects it.
  const activePlan = billingSummary?.subscription.plan ?? null;
  const currentPlanCode = activePlan?.code?.toLowerCase() ?? "";

  const closeUpgradePrompt = useCallback(() => {
    setBillingLimitModal(null);
    setUpgradeCheckoutError(null);
    setUpgradeCheckoutPlanCode(null);
  }, []);

  const handleUpgradePlanSelection = useCallback(
    async (planCode: string) => {
      const normalizedCode = planCode.toLowerCase();
      if (normalizedCode === "enterprise") {
        closeUpgradePrompt();
        router.push("/contact/");
        return;
      }

      if (normalizedCode === "free") {
        closeUpgradePrompt();
        return;
      }

      setUpgradeCheckoutError(null);
      setUpgradeCheckoutPlanCode(planCode);
      try {
        const origin = window.location.origin;
        const successUrl = `${origin}/billing/success/?flow=plan&plan=${encodeURIComponent(planCode)}`;
        const cancelUrl = `${origin}/billing/cancel/?flow=plan&plan=${encodeURIComponent(planCode)}`;
        const result = await createPlanCheckoutSession(
          planCode,
          successUrl,
          cancelUrl,
        );

        if (!result.ok) {
          setUpgradeCheckoutError(result.message);
          return;
        }

        window.location.assign(result.data.checkoutUrl);
      } finally {
        setUpgradeCheckoutPlanCode(null);
      }
    },
    [closeUpgradePrompt, router],
  );

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
  const maxAdminsPerGroup = activePlan?.maxAdminsPerGroup ?? null;
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

  const selectedConversationAdminCount =
    selectedConversationForLimits?.participants.filter(
      (participant) => participant.role === "admin",
    ).length ?? 0;

  const showUpgradeLimitPrompt = useCallback(
    (title: string, message: string) => {
      setUpgradeCheckoutError(null);
      setUpgradeCheckoutPlanCode(null);
      setBillingLimitError(message);
      setBillingLimitModal({ title, message });
    },
    [],
  );

  const handleOpenCreateLoop = useCallback(() => {
    if (isCreateLoopBlocked) {
      showUpgradeLimitPrompt(
        "Group limit reached",
        `You have reached your ${activePlan?.name ?? "current"} plan limit of ${maxGroups} groups. Upgrade your plan to create more groups.`,
      );
      return;
    }
    setBillingLimitError(null);
    requirePhoneVerified(() => setIsCreateLoopOpen(true));
  }, [
    isCreateLoopBlocked,
    activePlan?.name,
    maxGroups,
    requirePhoneVerified,
    showUpgradeLimitPrompt,
  ]);

  const handleOpenAddMembers = useCallback(() => {
    if (!selectedConversationForLimits) return;
    if (isAddMembersBlocked) {
      showUpgradeLimitPrompt(
        "Member limit reached",
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
    showUpgradeLimitPrompt,
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
  // The same mirror for the list. The socket handler has to know whether a
  // conversation is listed without re-subscribing every time the list changes.
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  // Conversations being fetched because a message arrived for one the list did
  // not have, so a burst of messages to it fetches it once rather than per
  // message.
  const fetchingConversations = useRef<Set<string>>(new Set());

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
  // Settings → Messaging → "Press Enter to send", kept in this browser.
  const { enterToSend } = useLocalMessagingPreferences();
  /**
   * What the next send will do, when it is not simply "post this".
   *
   * ONE piece of state for reply and edit rather than two, because they are
   * mutually exclusive by nature - a draft cannot both answer a message and
   * rewrite a different one - and two booleans would allow that state to be
   * represented at all. Cleared with the rest of the draft.
   */
  const [composerContext, setComposerContext] =
    useState<ComposerContext | null>(null);
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
        source: message.source,
        replyTo: message.replyTo,
        // Copied field by field, so a field left out here never reaches the
        // bubble - on load or on a live update.
        linkPreview: message.linkPreview,
        reactions: message.reactions,
        forwarded: message.forwarded,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
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
  // Group controls are for groups. A direct conversation has no settings, so
  // `groupSettings?.add_member_permission !== "admins"` came out TRUE and
  // offered Add members on a one-to-one thread - a third person in a
  // conversation that is by definition two.
  const isGroupConversation = selectedConversation?.kind === "group";
  const canAddMembers =
    isGroupConversation &&
    (isSelectedConversationAdmin ||
      groupSettings?.add_member_permission !== "admins");
  const canEditGroupSettings =
    isGroupConversation &&
    (isSelectedConversationAdmin ||
      groupSettings?.edit_group_permission !== "admins");

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
   *
   * `source` matters more than it looks. A `conversation.updated` frame is
   * serialized ONCE for the whole group, with nobody asking - so every field
   * whose answer depends on who is looking comes back as its empty value:
   * `is_admin` false for the admin who just made the change, `muted` and
   * `archived` false for everybody who set them, `unread` zero, and a direct
   * conversation's title blank. Taken at face value those wipe real state on
   * every settings change and every pin.
   *
   * So a broadcast contributes only what is the same for everyone, and the
   * viewer's own answers are kept. A REST response was serialized FOR this
   * viewer and is trusted in full.
   */
  const applyConversationUpdate = useCallback(
    (updated: Conversation, source: "response" | "broadcast" = "response") => {
      setConversations((prev) =>
        prev.map((existing) => {
          if (String(existing.id) !== String(updated.id)) return existing;

          const merged =
            source === "broadcast"
              ? {
                  ...existing,
                  // An allow-list, not a list of exceptions: a field added to
                  // the serializer later is viewer-independent only if
                  // somebody says so here, which is the safe default.
                  name:
                    updated.kind === "direct" ? existing.name : updated.name,
                  description: updated.description,
                  mode: updated.mode,
                  joinMode: updated.joinMode,
                  settings: updated.settings,
                  logoImage: updated.logoImage,
                  pinnedMessage: updated.pinnedMessage,
                }
              : { ...existing, ...updated };

          return {
            ...merged,
            participants: updated.participants.length
              ? updated.participants
              : existing.participants,
          };
        }),
      );
    },
    [setConversations],
  );

  /**
   * Swap a changed message into the thread it belongs to.
   *
   * By id, in place - an edit, a delete and a reaction all change a message
   * that is already on screen, so appending would show it twice and re-sorting
   * would move it away from the conversation it is part of.
   *
   * Keyed on the message's OWN conversation rather than the selected one, so a
   * `message.updated` frame for a Loop in the background is applied where it
   * belongs instead of being dropped or, worse, landing in the open thread.
   */
  const applyMessageUpdate = useCallback(
    (updated: ConversationMessage) => {
      setLoopMessages((previous) => {
        const key = updated.conversationId;
        const messages = previous.get(key);
        if (!messages?.some((message) => message.id === updated.id)) {
          return previous;
        }
        const next = new Map(previous);
        next.set(
          key,
          messages.map((message) =>
            message.id === updated.id ? toUiMessage(updated) : message,
          ),
        );
        return next;
      });

      // The sidebar quotes the newest message and the header holds the pinned
      // one, so a change has to reach both or the list keeps showing words the
      // thread no longer does.
      setConversations((prev) =>
        prev.map((conversation) => {
          if (String(conversation.id) !== String(updated.conversationId)) {
            return conversation;
          }

          // ONLY when this is the newest message. Editing something from last
          // week must not drag it into the sidebar as if it had just been
          // said - `lastMessageAt` is exactly the newest message's timestamp,
          // so comparing against it is the whole test.
          const isNewest =
            conversation.lastMessageAt !== null &&
            conversation.lastMessageAt === updated.createdAt;

          const stillPinned =
            conversation.pinnedMessage &&
            String(conversation.pinnedMessage.id) === String(updated.id)
              ? updated.deletedAt !== null
                ? // A deleted message stops being pinned - the server clears
                  // it too, and this keeps the bar honest if that frame is
                  // slower than this response.
                  null
                : updated
              : conversation.pinnedMessage;

          return {
            ...conversation,
            pinnedMessage: stillPinned,
            preview: isNewest
              ? composePreview(
                  updated.sender,
                  updated.deletedAt !== null
                    ? DELETED_MESSAGE_TEXT
                    : describeMessageBody(updated.text, updated.attachments),
                )
              : conversation.preview,
          };
        }),
      );
    },
    [toUiMessage, setConversations],
  );

  /**
   * A message arrived in a conversation - sent from here, or live from anyone
   * - so the list shows it.
   *
   * The row is UN-HIDDEN. Clearing a conversation takes it out of the list and
   * the server brings it back the moment somebody posts, but nothing here ever
   * set `cleared` back to false, so it stayed gone until a reload: the message
   * was delivered and there was no row to show it on.
   *
   * A conversation the list does not have at all is LOADED rather than
   * ignored - one the other person has just started, or one past the pages
   * loaded so far. Updating only rows that already existed is what dropped
   * those messages.
   */
  const noteMessageInList = useCallback(
    (
      conversationId: string | number,
      message: Message,
      lastMessageAt: string,
      countAsUnread: boolean,
    ) => {
      const key = String(conversationId);
      const listed = conversationsRef.current.some(
        (row) => String(row.id) === key,
      );

      if (!listed) {
        if (fetchingConversations.current.has(key)) return;
        fetchingConversations.current.add(key);
        void fetchConversation(conversationId).then((result) => {
          fetchingConversations.current.delete(key);
          if (!result.ok) return;
          setConversations((current) =>
            mergeConversations(current, [result.conversation]),
          );
        });
        return;
      }

      setConversations((current) =>
        current.map((row) =>
          String(row.id) === key
            ? {
                ...row,
                cleared: false,
                // The same composer the fetched path runs, so a live message
                // reads exactly like the same message reloaded.
                preview: composePreview(
                  message.sender,
                  describeMessageBody(message.text, message.attachments ?? []),
                ),
                lastMessageAt,
                unread: countAsUnread ? (row.unread || 0) + 1 : 0,
              }
            : row,
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
        // The SAME conversion the REST path runs. This used to hand-derive a
        // handful of fields and cast the rest of the raw snake_case frame,
        // which meant every field the serializer grew was silently absent over
        // the socket - present after a reload, missing live. `toUiMessage`
        // still settles `mine`, which no payload carries.
        const normalized = normalizeMessagePayload(
          rawMessage,
          targetConversationId,
        );
        if (!normalized) return;
        const newMessage = toUiMessage(normalized);

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

        // Counted unread only for a Loop that isn't the one currently open -
        // that one is being read.
        noteMessageInList(
          targetConversationId,
          newMessage,
          String(rawMessage.created_at ?? new Date().toISOString()),
          !isForSelectedConversation,
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
      } else if (message.type === "message.updated") {
        // A message ALREADY in the thread changed - edited, deleted, or reacted
        // to. It must replace the one on screen, never be appended: treating
        // this like `message.new` shows the same message twice.
        const updated = normalizeMessagePayload(message.message);
        if (updated) applyMessageUpdate(updated);
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
        if (updated) applyConversationUpdate(updated, "broadcast");
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
      }
    },
    [
      applyConversationUpdate,
      applyMessageUpdate,
      noteMessageInList,
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
    if (!selectedConversationId || isSendingMessage) return;

    // An edit replaces words rather than adding a message, so it has its own
    // route, its own emptiness rule - blank is a delete, not an edit - and it
    // never carries attachments.
    if (composerContext?.kind === "edit") {
      const text = messageInput.trim();
      if (!text) return;
      setIsSendingMessage(true);
      setMessageError(null);
      const result = await editConversationMessage(
        selectedConversationId,
        composerContext.message.id,
        text,
      );
      if (!result.ok) {
        setMessageError(result.message);
      } else {
        applyMessageUpdate(result.message);
        setMessageInput("");
        setComposerContext(null);
      }
      setIsSendingMessage(false);
      return;
    }

    if (!messageInput.trim() && messageAttachments.length === 0) return;
    // Sending is an explicit "I am at the end of this thread" gesture, so
    // follow the message down even if the reader had scrolled up.
    stickToBottomRef.current = true;
    setIsSendingMessage(true);
    setMessageError(null);
    const result = await sendConversationMessage(
      selectedConversationId,
      messageInput,
      messageAttachments,
      composerContext?.kind === "reply" ? composerContext.message.id : null,
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
      // Your own message moves the row too, and brings back a conversation you
      // had cleared - without waiting for the socket to echo it.
      noteMessageInList(
        selectedConversationId,
        toUiMessage(result.message),
        new Date().toISOString(),
        false,
      );
      setMessageInput("");
      setMessageAttachments([]);
      setComposerContext(null);
    }
    setIsSendingMessage(false);
  }, [
    messageAttachments,
    messageInput,
    selectedConversationId,
    isSendingMessage,
    toUiMessage,
    applyMessageUpdate,
    noteMessageInList,
    composerContext,
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

  /**
   * A direct conversation was opened - which may be one that already existed,
   * since the server hands back the same thread for a pair rather than a
   * second one. Selected by ID for that reason: "the newest" is right after
   * creating a group and wrong here.
   */
  async function handleDirectMessageStarted(conversationId: string | number) {
    setIsNewConversationOpen(false);

    // This one conversation, not the first page of the list. The list is
    // ordered by last activity and opening an existing DM is not activity, so a
    // quiet older thread is not on page one.
    const result = await fetchConversation(conversationId);
    if (!result.ok) return;

    // Shown even if you had cleared it: starting a conversation on purpose is
    // the opposite of hiding it. The server keeps it cleared only until the
    // first message, which is what you are about to send.
    const opened = { ...result.conversation, cleared: false };
    setPendingConversation(null);
    setConversations((current) =>
      mergeConversations(current, [opened]).map((conversation) => ({
        ...conversation,
        active: conversation.id === opened.id,
      })),
    );
    setSelectedConversationId(opened.id);
  }

  async function handleAddMembers(members: string[]) {
    if (!selectedConversationId) return;
    if (typeof maxMembersPerGroup === "number" && selectedConversation) {
      const projectedMembers =
        selectedConversation.participants.length + members.length;
      if (projectedMembers > maxMembersPerGroup) {
        showUpgradeLimitPrompt(
          "Member limit reached",
          `Adding ${members.length} member${members.length === 1 ? "" : "s"} exceeds your ${activePlan?.name ?? "current"} plan limit of ${maxMembersPerGroup} members per group. Upgrade your plan to continue.`,
        );
        throw new Error(
          `This group is limited to ${maxMembersPerGroup} members on your current plan.`,
        );
      }
    }

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
    if (typeof maxMembersPerGroup === "number" && selectedConversation) {
      const projectedMembers = selectedConversation.participants.length + 1;
      if (projectedMembers > maxMembersPerGroup) {
        showUpgradeLimitPrompt(
          "Member limit reached",
          `This group has reached your ${activePlan?.name ?? "current"} plan limit of ${maxMembersPerGroup} members per group. Upgrade your plan to add more members.`,
        );
        throw new Error(
          `This group is limited to ${maxMembersPerGroup} members on your current plan.`,
        );
      }
    }

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
                  <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-3xs font-semibold tracking-wide text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
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
              <span className="text-2xs leading-none text-slate-400 dark:text-slate-500">
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
              <p className="px-3 pt-1.5 pb-1 text-2xs leading-snug text-slate-400 dark:text-slate-500">
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
                    <p className="mt-1 text-2xs leading-snug text-slate-500 dark:text-slate-400">
                      {rowConfirm === "leave"
                        ? "You stop receiving it. Your messages stay in the group."
                        : "Clears it for you only. You stay in the group, and it comes back if somebody posts - with just the new messages."}
                    </p>

                    {rowActionError && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-2xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
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

  function handleTabChange(tab: AdminTab) {
    setAdminPanelTab(tab);
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

  // One menu at a time, owned here rather than per bubble - two open menus is
  // the bug the design explicitly rules out.
  const [messageMenu, setMessageMenu] = useState<{
    id: string | number;
    origin: ContextMenuOrigin;
  } | null>(null);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  // The message a modal is about, kept separately from the menu: the menu closes
  // the moment an item is picked, so a modal reading `menuMessage` would open
  // with nothing in it.
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  // One at a time, and named, so a failure can be shown next to the thing that
  // failed rather than as a general "something went wrong".
  const [actionBusy, setActionBusy] = useState<
    "forward" | "delete" | "pin" | "reaction" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset both when the conversation changes, using React's documented
  // "adjusting state when a prop changes" pattern rather than an effect: this
  // re-renders once immediately, where an effect would paint a stale menu
  // first and then undo itself. Deriving alone is not enough - the state would
  // survive and the menu would reappear at dead coordinates on returning to
  // the conversation, since the thread is scrolled back to the bottom by then.
  const [menuConversationId, setMenuConversationId] = useState(
    selectedConversationId,
  );
  if (menuConversationId !== selectedConversationId) {
    setMenuConversationId(selectedConversationId);
    setMessageMenu(null);
    setInfoMessage(null);
    setForwardMessage(null);
    setDeleteMessage(null);
    setActionError(null);
    // A draft reply, or a half-finished edit, belongs to the conversation it
    // was started in.
    setComposerContext(null);
  }
  const {
    copy: copyText,
    copied: messageCopied,
    error: copyError,
  } = useCopyToClipboard();

  const openMessageMenu = useCallback(
    (id: string | number, origin: ContextMenuOrigin) => {
      // Toggling, so pressing the same message's trigger twice puts the menu
      // away. Right-clicking a DIFFERENT message while one is open moves the
      // menu there rather than closing it, which is what a menu should do.
      setMessageMenu((current) =>
        current && current.id === id ? null : { id, origin },
      );
    },
    [],
  );

  // Both resolve against the thread that is on screen NOW, so changing
  // conversation closes the menu and the panel on its own - no effect that
  // writes state on the way in and needs a second render to undo itself.
  const menuMessage = useMemo(
    () =>
      messageMenu
        ? (currentMessages.find((row) => row.id === messageMenu.id) ?? null)
        : null,
    [messageMenu, currentMessages],
  );

  // Resolved back out of the thread rather than shown as the snapshot taken
  // when the menu item was picked: an edit, a delete or a reaction arriving
  // while the panel is open would otherwise leave it describing a message that
  // no longer exists in that form.
  const visibleInfoMessage = useMemo(
    () =>
      infoMessage
        ? (currentMessages.find((row) => row.id === infoMessage.id) ?? null)
        : null,
    [infoMessage, currentMessages],
  );

  /**
   * Add or take back one emoji on one message.
   *
   * Sends the state we want rather than a flip, so a retry after a dropped
   * response cannot undo itself - the endpoints are idempotent in both
   * directions precisely so this can be true.
   */
  const handleToggleReaction = useCallback(
    async (messageId: string | number, emoji: string, reacted: boolean) => {
      if (!selectedConversationId || actionBusy) return;
      setActionBusy("reaction");
      setActionError(null);
      const result = await setMessageReaction(
        selectedConversationId,
        messageId,
        emoji,
        reacted,
      );
      if (result.ok) {
        applyMessageUpdate(result.message);
      } else {
        setActionError(result.message);
      }
      setActionBusy(null);
    },
    [selectedConversationId, actionBusy, applyMessageUpdate],
  );

  /**
   * Pin a message above the thread, or let it go.
   *
   * The answer is the CONVERSATION, not the message - the pin lives there - so
   * it is folded back through the same merge the socket uses.
   */
  const handleSetPinned = useCallback(
    async (messageId: string | number, pinned: boolean) => {
      if (!selectedConversationId || actionBusy) return;
      setActionBusy("pin");
      setActionError(null);
      const result = await setPinnedMessage(
        selectedConversationId,
        messageId,
        pinned,
      );
      if (result.ok) {
        applyConversationUpdate(result.conversation);
      } else {
        setActionError(result.message);
      }
      setActionBusy(null);
    },
    [selectedConversationId, actionBusy, applyConversationUpdate],
  );

  const handleDeleteMessage = useCallback(async () => {
    if (!selectedConversationId || !deleteMessage || actionBusy) return;
    setActionBusy("delete");
    setActionError(null);
    const result = await deleteConversationMessage(
      selectedConversationId,
      deleteMessage.id,
    );
    if (result.ok) {
      applyMessageUpdate(result.message);
      setDeleteMessage(null);
      // Editing or answering something that no longer exists.
      setComposerContext((current) =>
        current && current.message.id === result.message.id ? null : current,
      );
    } else {
      setActionError(result.message);
    }
    setActionBusy(null);
  }, [selectedConversationId, deleteMessage, actionBusy, applyMessageUpdate]);

  /**
   * Send a message on to another Loop.
   *
   * The forward lands in the DESTINATION, which may not be the Loop on screen,
   * so there is nothing to insert here - the socket delivers it to whoever is
   * looking at that thread. Only the modal closes.
   */
  const handleForwardMessage = useCallback(
    async (targetConversationId: string | number) => {
      if (!forwardMessage || actionBusy) return;
      setActionBusy("forward");
      setActionError(null);
      const result = await forwardConversationMessage(
        targetConversationId,
        forwardMessage.id,
      );
      if (result.ok) {
        setForwardMessage(null);
      } else {
        setActionError(result.message);
      }
      setActionBusy(null);
    },
    [forwardMessage, actionBusy],
  );

  /** Put the message's words in the composer, ready to be rewritten. */
  const startEditing = useCallback((message: Message) => {
    setComposerContext({ kind: "edit", message });
    setMessageInput(message.text);
  }, []);

  const cancelComposerContext = useCallback(() => {
    setComposerContext((current) => {
      // An abandoned edit leaves the original's words in the box, which reads
      // as a draft nobody wrote. A cancelled reply keeps whatever was typed.
      if (current?.kind === "edit") setMessageInput("");
      return null;
    });
  }, []);

  const pinnedMessage = selectedConversation?.pinnedMessage ?? null;
  const isPinned = useCallback(
    (messageId: string | number) =>
      pinnedMessage !== null && String(pinnedMessage.id) === String(messageId),
    [pinnedMessage],
  );

  // A failure from an action with no dialog of its own - a reaction or a pin.
  // The modals show their own copy of `actionError`, so theirs is excluded
  // rather than announced twice.
  const bareActionError = forwardMessage || deleteMessage ? null : actionError;
  const isEditing = composerContext?.kind === "edit";

  /** Scroll a pinned message back into view. */
  const jumpToMessage = useCallback((messageId: string | number) => {
    const element = document.querySelector(
      `[data-message-id="${CSS.escape(String(messageId))}"]`,
    );
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
                  title="New conversation"
                  aria-haspopup="dialog"
                  onClick={() => setIsNewConversationOpen(true)}
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
                          className={`rounded-full px-1.5 text-3xs font-bold ${
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
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2 py-1 text-2xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
                    className={`rounded-full px-2.5 py-1 text-3xs font-semibold ${
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
                    {/* A group admin panel. A direct conversation has no admin and
                        nothing to configure, so it has no settings button. */}
                    {isGroupConversation && (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* BETWEEN the header and the scroll container, so it stays put while
              the thread moves under it - which is the whole point of a pin. */}
          {pinnedMessage && selectedConversation && (
            <PinnedMessageBar
              message={pinnedMessage}
              canUnpin={canPinMessage(selectedConversation, pinnedMessage)}
              onJump={jumpToMessage}
              onUnpin={() => void handleSetPinned(pinnedMessage.id, false)}
            />
          )}

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
                    <span className="rounded-full bg-white px-3 py-1 text-2xs font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                      {row.label}
                    </span>
                  </div>
                ) : (
                  <MessageBubble
                    key={row.key}
                    message={row.message}
                    startsRun={row.startsRun}
                    isLastOwn={row.message.id === lastOwnMessageId}
                    readers={readersOf(row.message.id)}
                    readableCount={readableBy.length}
                    isMenuOpen={messageMenu?.id === row.message.id}
                    onOpenMenu={openMessageMenu}
                    currentUsername={currentUsername}
                    onToggleReaction={handleToggleReaction}
                    reactionBusy={actionBusy === "reaction"}
                  />
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
                {composerContext && (
                  <ComposerContextBar
                    context={composerContext}
                    onCancel={cancelComposerContext}
                  />
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
                    {/* An edit changes words and nothing else - the endpoint
                        takes only text - so the two controls that produce
                        files are out while one is in progress rather than
                        accepting input that would be dropped. */}
                    <label
                      className={`flex items-center px-2 text-slate-500 ${
                        isEditing
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer"
                      }`}
                      title={
                        isEditing
                          ? "Not available while editing"
                          : "Attach files"
                      }
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
                        disabled={isSendingMessage || isEditing}
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
                      disabled={isSendingMessage || isEditing}
                      className={`px-1 disabled:opacity-40 ${isRecordingVoice ? "text-rose-600" : "text-slate-500"}`}
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
                      placeholder={
                        isEditing ? "Edit your message..." : "Type a message..."
                      }
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        notifyTyping();
                      }}
                      onKeyDown={(e) => {
                        // With "Press Enter to send" off, Enter does
                        // nothing - a one-line box has no new line to add -
                        // and Ctrl/Cmd+Enter still sends.
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          (enterToSend || e.metaKey || e.ctrlKey)
                        ) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                        // Escape backs out of a reply or an edit, which is
                        // where a hand already is - the strip's X needs the
                        // mouse.
                        if (e.key === "Escape" && composerContext) {
                          e.preventDefault();
                          cancelComposerContext();
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
                        // Blank is a delete, not an edit, so an edit needs
                        // words where a send would settle for a file.
                        (isEditing
                          ? !messageInput.trim()
                          : !messageInput.trim() &&
                            messageAttachments.length === 0)
                      }
                      className="rounded-xl bg-[linear-gradient(130deg,#02adff_0%,#297be3_100%)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isSendingMessage
                        ? isEditing
                          ? "Saving..."
                          : "Sending..."
                        : isEditing
                          ? "Save"
                          : "Send"}
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

      {/* Actions the viewer cannot take are LEFT OUT rather than greyed: a
          disabled Delete on somebody else's message still says "you might be
          able to delete this", which is the opposite of what it means. The two
          exceptions are Copy and Pin, which are disabled with a visible reason
          - nothing to copy, and already pinned. */}
      <ContextMenu
        origin={menuMessage ? (messageMenu?.origin ?? null) : null}
        onClose={() => setMessageMenu(null)}
        // The emoji row lives inside the menu rather than in a popover of its
        // own: one floating surface per message, and the menu already knows how
        // to anchor, dismiss and take focus.
        header={
          menuMessage ? (
            <ReactionBar
              mine={menuMessage.reactions
                .filter((reaction) => hasReacted(reaction, currentUsername))
                .map((reaction) => reaction.emoji)}
              onSelect={(emoji, reacted) => {
                void handleToggleReaction(menuMessage.id, emoji, reacted);
                setMessageMenu(null);
              }}
            />
          ) : null
        }
        items={
          menuMessage
            ? [
                {
                  id: "reply",
                  label: "Reply",
                  icon: <CornerUpLeft className="h-4 w-4" />,
                  onSelect: () =>
                    setComposerContext({
                      kind: "reply",
                      message: menuMessage,
                    }),
                },
                {
                  id: "forward",
                  label: "Forward",
                  icon: <CornerUpRight className="h-4 w-4" />,
                  onSelect: () => setForwardMessage(menuMessage),
                },
                {
                  id: "copy",
                  label: "Copy",
                  icon: <Copy className="h-4 w-4" />,
                  disabled: !menuMessage.text,
                  onSelect: () => {
                    if (menuMessage.text) void copyText(menuMessage.text);
                  },
                },
                ...(selectedConversation &&
                canPinMessage(selectedConversation, menuMessage)
                  ? [
                      {
                        id: "pin",
                        label: isPinned(menuMessage.id) ? "Unpin" : "Pin",
                        icon: isPinned(menuMessage.id) ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        ),
                        onSelect: () =>
                          void handleSetPinned(
                            menuMessage.id,
                            !isPinned(menuMessage.id),
                          ),
                      } satisfies ContextMenuItem,
                    ]
                  : []),
                ...(canEditMessage(menuMessage)
                  ? [
                      {
                        id: "edit",
                        label: "Edit",
                        icon: <Pencil className="h-4 w-4" />,
                        onSelect: () => startEditing(menuMessage),
                      } satisfies ContextMenuItem,
                    ]
                  : []),
                { kind: "separator", id: "sep" },
                {
                  id: "info",
                  label: "Message info",
                  icon: <Info className="h-4 w-4" />,
                  onSelect: () => setInfoMessage(menuMessage),
                },
                ...(canDeleteMessage(
                  menuMessage,
                  selectedConversation?.isAdmin ?? false,
                )
                  ? [
                      {
                        id: "delete",
                        label: "Delete",
                        icon: <Trash2 className="h-4 w-4" />,
                        tone: "danger",
                        onSelect: () => setDeleteMessage(menuMessage),
                      } satisfies ContextMenuItem,
                    ]
                  : []),
              ]
            : []
        }
      />

      {forwardMessage && (
        <ForwardMessageModal
          message={forwardMessage}
          conversations={conversations}
          sourceConversationId={selectedConversationId}
          busy={actionBusy === "forward"}
          error={actionBusy === null ? actionError : null}
          onForward={(target) => void handleForwardMessage(target)}
          onClose={() => {
            setForwardMessage(null);
            setActionError(null);
          }}
        />
      )}

      {deleteMessage && (
        <DeleteMessageDialog
          message={deleteMessage}
          asAdmin={!deleteMessage.mine}
          busy={actionBusy === "delete"}
          error={actionBusy === null ? actionError : null}
          onConfirm={() => void handleDeleteMessage()}
          onClose={() => {
            setDeleteMessage(null);
            setActionError(null);
          }}
        />
      )}

      {/* No toast system exists, and ActivityToasts is hardwired to
          notification frames - so the acknowledgement is its own small thing.

          A reaction and a pin have nowhere else to report a failure: neither
          opens a dialog, so without this a refused pin looks exactly like one
          that worked. Errors belonging to a modal are shown inside it, and are
          skipped here so they are not said twice. */}
      {(messageCopied || copyError || bareActionError) && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow-lg ${
            copyError || bareActionError ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {copyError || bareActionError || "Message copied"}
        </div>
      )}

      <MessageInfoModal
        message={visibleInfoMessage}
        participants={selectedConversation?.participants ?? []}
        currentUsername={currentUsername}
        onClose={() => setInfoMessage(null)}
      />

      {/* Mounted per open, so the search box and results start empty each
          time rather than showing whoever was looked up last. */}
      {isNewConversationOpen && (
        <NewConversationModal
          onClose={() => setIsNewConversationOpen(false)}
          onStarted={handleDirectMessageStarted}
          onCreateGroup={() => {
            setIsNewConversationOpen(false);
            handleOpenCreateLoop();
          }}
        />
      )}

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

      {billingLimitModal && (
        <Modal
          isOpen={Boolean(billingLimitModal)}
          onClose={closeUpgradePrompt}
          title={billingLimitModal.title}
          description="Your current plan limit has been reached."
          closeLabel="Close upgrade prompt"
          footer={
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={closeUpgradePrompt}
                fullWidth
              >
                Not now
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {billingLimitModal.message}
          </p>
          {upgradeCheckoutError && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {upgradeCheckoutError}
            </p>
          )}
          <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
            {modalPlans.length === 0 && (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Plans are loading. You can still view all options on the pricing
                page.
              </p>
            )}
            {modalPlans.map((plan) =>
              (() => {
                const code = plan.code.toLowerCase();
                const isCurrentPlan = code === currentPlanCode;
                const isFreePlan = code === "free";
                const isEnterprisePlan = code === "enterprise";
                const canChoose =
                  !isCurrentPlan && !isFreePlan && !isEnterprisePlan;
                const isRedirectingToCheckout =
                  upgradeCheckoutPlanCode === plan.code;

                return (
                  <article
                    key={`upgrade-plan-${plan.code}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {plan.name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {plan.price}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {plan.summary}
                        </p>
                      </div>
                      {isCurrentPlan ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Current plan
                        </span>
                      ) : isEnterprisePlan ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void handleUpgradePlanSelection(plan.code)
                          }
                          disabled={upgradeCheckoutPlanCode !== null}
                        >
                          Contact sales
                        </Button>
                      ) : canChoose ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void handleUpgradePlanSelection(plan.code)
                          }
                          disabled={upgradeCheckoutPlanCode !== null}
                        >
                          {isRedirectingToCheckout
                            ? "Redirecting..."
                            : "Choose"}
                        </Button>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          Included
                        </span>
                      )}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-400">
                      {plan.features.map((feature) => (
                        <li key={`${plan.code}-${feature}`}>{feature}</li>
                      ))}
                    </ul>
                  </article>
                );
              })(),
            )}
          </div>
        </Modal>
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
                    if (
                      role === "admin" &&
                      typeof maxAdminsPerGroup === "number" &&
                      selectedConversation
                    ) {
                      const targetMember =
                        selectedConversation.participants.find(
                          (participant) => participant.id === memberId,
                        );
                      const isAlreadyAdmin = targetMember?.role === "admin";
                      if (
                        !isAlreadyAdmin &&
                        selectedConversationAdminCount >= maxAdminsPerGroup
                      ) {
                        showUpgradeLimitPrompt(
                          "Admin limit reached",
                          `This group has reached your ${activePlan?.name ?? "current"} plan limit of ${maxAdminsPerGroup} admin${maxAdminsPerGroup === 1 ? "" : "s"}. Upgrade your plan to assign more admins.`,
                        );
                        throw new Error(
                          `This group is limited to ${maxAdminsPerGroup} admin${maxAdminsPerGroup === 1 ? "" : "s"} on your current plan.`,
                        );
                      }
                    }

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
