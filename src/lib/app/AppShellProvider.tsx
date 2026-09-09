"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  displayNameForSession,
  fetchUserProfile,
  getSession,
  logout,
  useAccessToken,
} from "@/lib/auth/client";
import { useWebSocket } from "@/lib/websocket/useWebSocket";
import {
  conversationMode,
  fetchConversations,
  type Conversation,
} from "@/lib/chat/conversations";
import { fetchNotifications } from "@/lib/chat/notifications";
import type { UserProfile } from "@/components/settings/UserSettingsPanel";

export type SocketMessage = {
  type: string;
  [key: string]: unknown;
};

type SocketListener = (message: SocketMessage) => void;

type AppShellContextType = {
  // Exposed as the same [value, setValue] tuples HomeShell used when these
  // lived in its own useState, so every existing call site works unchanged.
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  // The list is paged. Scrolling to the end of it asks for the next page.
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;
  loadMoreConversations: () => void;
  userProfile: UserProfile;
  setUserProfile: Dispatch<SetStateAction<UserProfile>>;

  // Unread totals split by mode, for the badges beside "Chats" and
  // "Broadcast" in the nav rail. Invite badges stay inside HomeShell; they are
  // a chat-list concern.
  unreadByMode: { chat: number; broadcast: number };

  logOut: () => Promise<void>;

  // "Create group" is a rail action, not a destination. The rail bumps this
  // counter and routes to /chats/, where HomeShell opens the existing modal.
  // A counter rather than a boolean so a second click re-opens a closed modal.
  createLoopRequest: number;
  requestCreateLoop: () => void;

  // Which conversation another screen has asked Chats to open. Carried here
  // rather than as a query param because useSearchParams forces the tree up
  // to the nearest Suspense boundary to client-render on a prerendered route.
  conversationToOpen: string | number | null;
  requestOpenConversation: (conversationId: string | number) => void;
  clearConversationToOpen: () => void;

  // Below md the rail is an overlay drawer. The button that opens it lives in
  // each route's own header, so the state has to be reachable from all of them.
  isNavDrawerOpen: boolean;
  openNavDrawer: () => void;
  closeNavDrawer: () => void;

  // One socket for the whole app. It subscribes to every conversation the
  // user belongs to, so it belongs here rather than inside a route: mounted
  // per-conversation it could not see traffic for any other Loop, which is
  // what unread counting and typing indicators both need.
  socketStatus: string;
  sendSocketMessage: (message: SocketMessage) => void;
  subscribeToSocket: (listener: SocketListener) => () => void;

  // Unread activity, for the rail badge. Held here rather than on the page so
  // the badge is right before anybody has opened Activity.
  activityUnread: number;
  setActivityUnread: (count: number) => void;
  // Bumped when a notification arrives on the socket, so an open Activity
  // page refetches instead of polling for something that may never come.
  activityVersion: number;
};

const AppShellContext = createContext<AppShellContextType | undefined>(
  undefined,
);

/**
 * Fold a freshly fetched first page into a list that may already hold more.
 *
 * Updates what it recognises in place and puts anything genuinely new at the
 * front, rather than truncating the reader back to twenty rows every time
 * somebody adds them to a group.
 */
function mergeFirstPage(
  current: Conversation[],
  firstPage: Conversation[],
): Conversation[] {
  const incoming = new Map(firstPage.map((row) => [String(row.id), row]));
  const kept = current
    .filter((row) => !incoming.has(String(row.id)))
    .map((row) => row);
  return [...firstPage, ...kept];
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] =
    useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    displayName: displayNameForSession(getSession()),
  }));
  const [createLoopRequest, setCreateLoopRequest] = useState(0);
  const [conversationToOpen, setConversationToOpen] = useState<
    string | number | null
  >(null);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [activityUnread, setActivityUnread] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);

  // Lives here rather than in HomeShell so the list survives navigating to
  // Settings and back - the provider sits above the route in the (app) layout.
  useEffect(() => {
    let cancelled = false;

    fetchConversations().then((result) => {
      if (cancelled || !result.ok) return;
      setConversations(
        result.conversations.map((conversation, index) => ({
          ...conversation,
          active: index === 0,
        })),
      );
      setHasMoreConversations(result.hasMore);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the activity badge, so it is right before Activity is ever opened.
  useEffect(() => {
    let cancelled = false;

    fetchNotifications({ unreadOnly: true }).then((result) => {
      if (cancelled || !result.ok) return;
      setActivityUnread(result.page.unreadCount);
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

  const unreadByMode = useMemo(
    () =>
      conversations.reduce(
        (totals, conversation) => {
          // Archived Loops are excluded: the rail badge should only count
          // what is in the list it points at, and an archived Loop is not.
          // Its unread is shown on the Archived row instead.
          if (conversation.archived) return totals;
          totals[conversationMode(conversation)] += conversation.unread || 0;
          return totals;
        },
        { chat: 0, broadcast: 0 },
      ),
    [conversations],
  );

  const logOut = useCallback(async () => {
    await logout();
    router.push("/login/");
  }, [router]);

  const requestCreateLoop = useCallback(() => {
    setCreateLoopRequest((count) => count + 1);
  }, []);

  const loadMoreConversations = useCallback(() => {
    if (!hasMoreConversations || isLoadingMoreConversations) return;
    const nextPage = conversationPage + 1;
    setIsLoadingMoreConversations(true);

    fetchConversations({ page: nextPage }).then((result) => {
      setIsLoadingMoreConversations(false);
      if (!result.ok) return;
      setConversations((current) => {
        // A page can overlap the one before it: a conversation that moved to
        // the top between requests pushes another across the boundary.
        const known = new Set(current.map((row) => String(row.id)));
        const fresh = result.conversations.filter(
          (row) => !known.has(String(row.id)),
        );
        return [...current, ...fresh];
      });
      setConversationPage(nextPage);
      setHasMoreConversations(result.hasMore);
    });
  }, [conversationPage, hasMoreConversations, isLoadingMoreConversations]);

  const requestOpenConversation = useCallback(
    (conversationId: string | number) => setConversationToOpen(conversationId),
    [],
  );
  const clearConversationToOpen = useCallback(
    () => setConversationToOpen(null),
    [],
  );

  const openNavDrawer = useCallback(() => setIsNavDrawerOpen(true), []);
  const closeNavDrawer = useCallback(() => setIsNavDrawerOpen(false), []);

  // -- the socket -------------------------------------------------------
  //
  // Listeners are held in a ref and notified through a STABLE callback.
  // useWebSocket rebuilds its connection whenever onMessage changes identity,
  // so handing it a subscriber that re-creates each render would tear the
  // socket down and open a new one on every keystroke.
  const socketListeners = useRef<Set<SocketListener>>(new Set());

  const subscribeToSocket = useCallback((listener: SocketListener) => {
    socketListeners.current.add(listener);
    return () => {
      socketListeners.current.delete(listener);
    };
  }, []);

  const handleSocketMessage = useCallback((message: SocketMessage) => {
    // Handled here rather than by a listener, so these keep working on every
    // route. HomeShell subscribes too, but it only exists on /chats/ and
    // /broadcast/ - a group created while the recipient sat on Activity or
    // Settings had nobody listening, so it simply never appeared.
    if (message.type === "notification.new") {
      setActivityUnread((count) => count + 1);
      setActivityVersion((version) => version + 1);
    }

    // Joining or leaving a conversation changes the list this provider owns,
    // so the list is what has to react to it.
    if (
      message.type === "conversation.added" ||
      message.type === "conversation.removed"
    ) {
      // Only the first page: replacing the whole list would throw away every
      // later page the reader has scrolled to. Conversations are ordered by
      // most recent activity, so anything that just changed is on it.
      fetchConversations().then((result) => {
        if (!result.ok) return;
        setConversations((current) =>
          mergeFirstPage(current, result.conversations),
        );
      });
    }

    socketListeners.current.forEach((listener) => listener(message));
  }, []);

  // Reactive, not a one-off read: a refresh replaces the token, and a socket
  // still holding the old one is closed by the server and reconnects with the
  // same dead token until it runs out of attempts.
  const accessToken = useAccessToken();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const socketProtocol = apiBaseUrl?.startsWith("https:") ? "wss:" : "ws:";
  const socketHost =
    process.env.NEXT_PUBLIC_WS_HOST ||
    (apiBaseUrl ? new URL(apiBaseUrl).host : "127.0.0.1:8000");
  const socketUrl = `${socketProtocol}//${socketHost}/ws/chat/?token=${encodeURIComponent(
    accessToken || "",
  )}`;

  const { status: socketStatus, send: sendSocketMessage } = useWebSocket({
    url: socketUrl,
    enabled: Boolean(accessToken),
    onMessage: handleSocketMessage,
  });

  const value = useMemo(
    () => ({
      conversations,
      setConversations,
      hasMoreConversations,
      isLoadingMoreConversations,
      loadMoreConversations,
      userProfile,
      setUserProfile,
      unreadByMode,
      logOut,
      createLoopRequest,
      requestCreateLoop,
      conversationToOpen,
      requestOpenConversation,
      clearConversationToOpen,
      isNavDrawerOpen,
      openNavDrawer,
      closeNavDrawer,
      socketStatus,
      sendSocketMessage,
      subscribeToSocket,
      activityUnread,
      setActivityUnread,
      activityVersion,
    }),
    [
      conversations,
      hasMoreConversations,
      isLoadingMoreConversations,
      loadMoreConversations,
      userProfile,
      unreadByMode,
      logOut,
      createLoopRequest,
      requestCreateLoop,
      conversationToOpen,
      requestOpenConversation,
      clearConversationToOpen,
      isNavDrawerOpen,
      openNavDrawer,
      closeNavDrawer,
      socketStatus,
      sendSocketMessage,
      subscribeToSocket,
      activityUnread,
      activityVersion,
    ],
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return context;
}
