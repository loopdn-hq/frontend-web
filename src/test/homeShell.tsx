// Stand-ins for what HomeShell is mounted inside and what it opens: the app
// shell (with a conversation list that really updates, and a socket the test
// can speak through) and the dialogs, which have tests of their own.
//
// Nothing here may import a module the HomeShell tests mock - the mock
// factories load this file, and that would go round in a circle.
import { useEffect, useState } from "react";
import { vi } from "vitest";
import type { Conversation } from "@/lib/chat/conversations";

type Frame = Record<string, unknown>;
type Listener = (frame: Frame) => void;

const listeners = new Set<Listener>();

export const shell = {
  /** What the list starts as; set before rendering. */
  initial: [] as Conversation[],
  /** What the list is now, after whatever HomeShell did to it. */
  latest: [] as Conversation[],
  createLoopRequest: 0,
  socketStatus: "connected",
  conversationToOpen: null as string | number | null,
  hasMoreConversations: false,
  isLoadingMoreConversations: false,
  isLoadingConversations: false,
  conversationsError: null as string | null,
  enterToSend: true,
  sponsored: null as { afterMessageId: string; card: unknown } | null,
  sendSocketMessage: vi.fn(),
  clearConversationToOpen: vi.fn(),
  reloadConversations: vi.fn(),
  loadMoreConversations: vi.fn(),
};

export const clipboard = { copy: vi.fn(), copied: false, error: "" };

/** The props each stubbed dialog was last rendered with. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const captured: Record<string, any> = {};

export function resetShell() {
  listeners.clear();
  Object.assign(shell, {
    initial: [],
    latest: [],
    createLoopRequest: 0,
    socketStatus: "connected",
    conversationToOpen: null,
    hasMoreConversations: false,
    isLoadingMoreConversations: false,
    isLoadingConversations: false,
    conversationsError: null,
    enterToSend: true,
    sponsored: null,
  });
  Object.assign(clipboard, { copied: false, error: "" });
  for (const key of Object.keys(captured)) delete captured[key];
}

function subscribeToSocket(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Deliver one frame to everything subscribed, as the socket would. */
export function emitFrame(frame: Frame) {
  for (const listener of [...listeners]) listener(frame);
}

export function useFakeAppShell() {
  const [conversations, setConversations] = useState(shell.initial);
  useEffect(() => {
    shell.latest = conversations;
  }, [conversations]);
  return {
    conversations,
    setConversations,
    createLoopRequest: shell.createLoopRequest,
    socketStatus: shell.socketStatus,
    sendSocketMessage: shell.sendSocketMessage,
    subscribeToSocket,
    conversationToOpen: shell.conversationToOpen,
    clearConversationToOpen: shell.clearConversationToOpen,
    hasMoreConversations: shell.hasMoreConversations,
    isLoadingMoreConversations: shell.isLoadingMoreConversations,
    isLoadingConversations: shell.isLoadingConversations,
    conversationsError: shell.conversationsError,
    reloadConversations: shell.reloadConversations,
    loadMoreConversations: shell.loadMoreConversations,
  };
}

export function useFakeSponsoredSlot() {
  return shell.sponsored;
}

export function SponsoredStub() {
  return <div data-testid="sponsored-card" />;
}

export function CallButtonsStub({ canStart }: { canStart: boolean }) {
  return <span data-testid="call-buttons">{String(canStart)}</span>;
}

type Props = Record<string, unknown>;

/** Keep the props a stub was last rendered with, for the test to call. */
function useCapture(name: string, props: Props) {
  useEffect(() => {
    captured[name] = props;
  });
}

export function AdminPanelStub(props: Props) {
  useCapture("admin", props);
  return (
    <div data-testid="admin-panel">
      {String(props.loopName)}|{String(props.activeTab)}
    </div>
  );
}

export function AddMembersStub(props: Props) {
  useCapture("addMembers", props);
  return props.isOpen ? (
    <div data-testid="add-members">{String(props.groupName)}</div>
  ) : null;
}

export function NewConversationStub(props: Props) {
  useCapture("newConversation", props);
  return <div data-testid="new-conversation" />;
}

export function CreateLoopStub(props: Props) {
  useCapture("createLoop", props);
  return props.isOpen ? <div data-testid="create-loop" /> : null;
}

export function JoinLoopStub(props: Props) {
  useCapture("joinLoop", props);
  return null;
}
