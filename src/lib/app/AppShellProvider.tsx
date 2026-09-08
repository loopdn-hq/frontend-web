"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from "@/lib/auth/client";
import {
  fetchConversations,
  type Conversation,
} from "@/lib/chat/conversations";
import type { UserProfile } from "@/components/settings/UserSettingsPanel";

type AppShellContextType = {
  // Exposed as the same [value, setValue] tuples HomeShell used when these
  // lived in its own useState, so every existing call site works unchanged.
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  userProfile: UserProfile;
  setUserProfile: Dispatch<SetStateAction<UserProfile>>;

  // Unread total across every Loop - the badge beside "Chats" in the nav rail.
  // Invite badges stay inside HomeShell; they are a chat-list concern.
  totalUnread: number;

  logOut: () => Promise<void>;

  // "Create group" is a rail action, not a destination. The rail bumps this
  // counter and routes to /chats/, where HomeShell opens the existing modal.
  // A counter rather than a boolean so a second click re-opens a closed modal.
  createLoopRequest: number;
  requestCreateLoop: () => void;

  // Below md the rail is an overlay drawer. The button that opens it lives in
  // each route's own header, so the state has to be reachable from all of them.
  isNavDrawerOpen: boolean;
  openNavDrawer: () => void;
  closeNavDrawer: () => void;
};

const AppShellContext = createContext<AppShellContextType | undefined>(
  undefined,
);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    displayName: displayNameForSession(getSession()),
  }));
  const [createLoopRequest, setCreateLoopRequest] = useState(0);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);

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

  const totalUnread = conversations.reduce(
    (sum, conversation) => sum + (conversation.unread || 0),
    0,
  );

  const logOut = useCallback(async () => {
    await logout();
    router.push("/login/");
  }, [router]);

  const requestCreateLoop = useCallback(() => {
    setCreateLoopRequest((count) => count + 1);
  }, []);

  const openNavDrawer = useCallback(() => setIsNavDrawerOpen(true), []);
  const closeNavDrawer = useCallback(() => setIsNavDrawerOpen(false), []);

  const value = useMemo(
    () => ({
      conversations,
      setConversations,
      userProfile,
      setUserProfile,
      totalUnread,
      logOut,
      createLoopRequest,
      requestCreateLoop,
      isNavDrawerOpen,
      openNavDrawer,
      closeNavDrawer,
    }),
    [
      conversations,
      userProfile,
      totalUnread,
      logOut,
      createLoopRequest,
      requestCreateLoop,
      isNavDrawerOpen,
      openNavDrawer,
      closeNavDrawer,
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
