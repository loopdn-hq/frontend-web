// Fixtures and defaults for the HomeShell tests. Imported by the test files
// only, after their mocks are in place, so everything from the chat and
// billing modules here is the mocked version.
import { act, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { HomeShell } from "@/components/home/HomeShell";
import { fetchBillingPlans, fetchBillingSummary } from "@/lib/billing";
import {
  fetchConversation,
  fetchConversationParticipants,
  fetchConversations,
  fetchJoinRequests,
  fetchMessageHistory,
  markConversationRead,
  type Conversation,
  type ConversationMessage,
  type ConversationMode,
  type ConversationParticipant,
  type GroupSettings,
} from "@/lib/chat/conversations";
import { GROUP } from "@/lib/rbac/conversation";
import { resetShell, shell } from "@/test/homeShell";

export const ALL_FEATURES: string[] = Object.values(GROUP);

export const SETTINGS: GroupSettings = {
  mode: "chat",
  join_mode: "open",
  add_member_permission: "admins",
  edit_group_permission: "admins",
  sms_delivery_enabled: true,
  sms_replies_enabled: true,
  voice_messages_enabled: true,
  media_enabled: true,
  reactions_enabled: true,
  category: null,
  region: "",
};

export function person(
  id: string,
  name: string,
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id,
    userId: `10${id}`,
    name,
    username: name.toLowerCase(),
    role: "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
    channels: {},
    blockedByMe: false,
    ...overrides,
  };
}

/** The viewer is signed in as "sam". */
export const SAM = person("1", "Sam", { role: "admin" });
export const ADA = person("2", "Ada");
export const LIN = person("3", "Lin");

export function conversation(
  id: number,
  name: string,
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id,
    kind: "group",
    name,
    description: "",
    mode: "chat",
    joinMode: "open",
    logoImage: null,
    settings: { ...SETTINGS, mode: overrides.mode ?? "chat" },
    preview: "",
    lastMessageAt: null,
    unread: 0,
    muted: false,
    archived: false,
    cleared: false,
    isAdmin: false,
    features: [GROUP.send],
    smsNumber: null,
    participants: [SAM, ADA],
    pinnedMessage: null,
    ...overrides,
  };
}

export function direct(
  id: number,
  counterpart: ConversationParticipant = ADA,
  overrides: Partial<Conversation> = {},
): Conversation {
  return conversation(id, counterpart.name, {
    kind: "direct",
    joinMode: null,
    settings: null,
    participants: [SAM, counterpart],
    ...overrides,
  });
}

/** A time today, so the thread files it under "Today". */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function message(
  id: number,
  text: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id,
    conversationId: 1,
    sender: "Ada",
    senderUsername: "ada",
    text,
    createdAt: minutesAgo(1),
    attachments: [],
    mine: false,
    reactions: [],
    forwarded: false,
    editedAt: null,
    deletedAt: null,
    source: "app",
    mentions: [],
    mentionsEveryone: false,
    ...overrides,
  };
}

export function mine(
  id: number,
  text: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return message(id, text, {
    sender: "Sam",
    senderUsername: "sam",
    mine: true,
    ...overrides,
  });
}

/** A message as the socket sends it. */
export function wireMessage(
  id: number,
  text: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    conversation: 1,
    sender: { username: "ada", display_label: "Ada" },
    text,
    created_at: minutesAgo(0),
    ...overrides,
  };
}

export function historyIs(messages: ConversationMessage[], hasMore = false) {
  vi.mocked(fetchMessageHistory).mockResolvedValue({
    ok: true,
    messages,
    hasMore,
  } as never);
}

export function planIs(
  plan: Record<string, unknown> | null,
  plans: Record<string, unknown>[] = [],
) {
  vi.mocked(fetchBillingSummary).mockResolvedValue(
    (plan
      ? { ok: true, data: { subscription: { plan } } }
      : { ok: false, message: "Billing is down." }) as never,
  );
  vi.mocked(fetchBillingPlans).mockResolvedValue({
    ok: true,
    data: plans,
  } as never);
}

/** Answers that leave everything as the fixtures have it. */
export function resetHomeShell() {
  resetShell();
  vi.clearAllMocks();
  planIs({
    code: "free",
    name: "Free",
    maxGroups: null,
    maxMembersPerGroup: null,
    maxAdminsPerGroup: null,
  });
  vi.mocked(fetchConversation).mockImplementation(
    async (id) =>
      ({
        ok: true,
        conversation:
          shell.latest.find((row) => String(row.id) === String(id)) ??
          conversation(Number(id), `Loop ${id}`),
      }) as never,
  );
  vi.mocked(fetchConversationParticipants).mockResolvedValue({
    ok: false,
    message: "x",
  } as never);
  vi.mocked(fetchConversations).mockResolvedValue({
    ok: false,
    message: "x",
  } as never);
  vi.mocked(fetchJoinRequests).mockResolvedValue({
    ok: true,
    requests: [],
  } as never);
  vi.mocked(markConversationRead).mockResolvedValue(undefined as never);
  historyIs([]);
}

/** Let every answer already on its way land. */
export async function flush() {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
}

export async function renderShell(
  rows: Conversation[],
  mode: ConversationMode = "chat",
) {
  shell.initial = rows;
  shell.latest = rows;
  const view = render(<HomeShell mode={mode} />);
  await flush();
  return { ...view, rerender: () => view.rerender(<HomeShell mode={mode} />) };
}

/** The chat list. */
export function list() {
  return within(screen.getByRole("complementary"));
}

/** One conversation's row in the list: the row button and its menu beside it. */
export function row(name: string): HTMLElement {
  const title = list()
    .getAllByText(name)
    .find((element) => element.closest("button") !== null);
  if (!title) throw new Error(`No row for ${name}`);
  return title.closest("button")!.parentElement as HTMLElement;
}

export function rowButton(name: string): HTMLElement {
  return row(name).querySelector("button") as HTMLElement;
}

export function listed(): (string | null | undefined)[] {
  return Array.from(
    screen
      .getByRole("complementary")
      .querySelectorAll<HTMLElement>(
        "[class*='group/row'] > button:first-child",
      ),
  ).map((button) => button.querySelector("p")?.textContent);
}

/** The open conversation: its header, thread and composer. */
export function panel() {
  return within(document.querySelector("section") as HTMLElement);
}

/** The line under the open conversation's name. */
export function subtitle(): HTMLElement {
  return panel().getByRole("heading", { level: 2 })
    .nextElementSibling as HTMLElement;
}

export function composer(): HTMLInputElement {
  return screen.getByPlaceholderText(/Type a message|Edit your message/);
}
