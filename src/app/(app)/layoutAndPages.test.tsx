import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const router = { replace };
let auth: { session: string | null; isLoaded: boolean };
let features = new Set<string>();
let featuresLoading = false;
let desktop = false;

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/client", () => ({
  fetchCurrentUser: vi.fn(async () => {}),
  useAuth: () => auth,
}));
vi.mock("@/lib/rbac", () => ({
  useFeatures: () => ({ features, loading: featuresLoading }),
}));
vi.mock("@/lib/config/origin", () => ({ isDesktop: () => desktop }));
vi.mock("@/lib/config/site", () => ({
  commercialSiteUrl: (path: string) => `https://ads.loopdn.com${path}`,
}));
vi.mock("@/lib/app/AppShellProvider", () => ({
  AppShellProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));
vi.mock("@/lib/calls/CallProvider", () => ({
  CallProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="calls">{children}</div>
  ),
}));
vi.mock("@/components/app/AppNavRail", () => ({
  AppNavRail: () => <nav aria-label="Primary" />,
}));
vi.mock("@/components/app/ActivityToasts", () => ({
  ActivityToasts: () => <div data-testid="toasts" />,
}));
vi.mock("@/components/calls/CallLayer", () => ({
  CallLayer: () => <div data-testid="call-layer" />,
}));
vi.mock("@/components/home/HomeShell", () => ({
  HomeShell: ({ mode }: { mode: string }) => (
    <div data-testid="home-shell">{mode}</div>
  ),
}));
vi.mock("@/components/app/NavDrawerButton", () => ({
  NavDrawerButton: () => <button>Open navigation</button>,
}));

import AiAssistantPage from "@/app/(app)/ai-assistant/page";
import BroadcastPage from "@/app/(app)/broadcast/page";
import ChatsPage from "@/app/(app)/chats/page";
import CommunitiesPage from "@/app/(app)/communities/page";
import ContactsPage from "@/app/(app)/contacts/page";
import HomePage from "@/app/(app)/home/page";
import AppLayout from "@/app/(app)/layout";
import MediaPage from "@/app/(app)/media/page";
import StarredPage from "@/app/(app)/starred/page";
import { fetchCurrentUser } from "@/lib/auth/client";
import { stubLocation } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
  auth = { session: "sam", isLoaded: true };
  features = new Set(["chat.access"]);
  featuresLoading = false;
  desktop = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppLayout", () => {
  it("shows nothing until the session has been read", () => {
    auth = { session: null, isLoaded: false };
    const { container } = render(<AppLayout>page</AppLayout>);
    expect(container).toBeEmptyDOMElement();
    expect(replace).not.toHaveBeenCalled();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the login page", () => {
    auth = { session: null, isLoaded: true };
    const { container } = render(<AppLayout>page</AppLayout>);
    expect(container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("wraps the page in the shell, the rail, the toasts and the call layer", () => {
    render(<AppLayout>the page</AppLayout>);
    expect(screen.getByTestId("shell")).toContainElement(
      screen.getByTestId("calls"),
    );
    expect(screen.getByTestId("calls")).toHaveTextContent("the page");
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("toasts")).toBeInTheDocument();
    expect(screen.getByTestId("call-layer")).toBeInTheDocument();
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends an advertiser-only account to the advertiser site", () => {
    const location = stubLocation("https://loopdn.com/chats/");
    features = new Set(["commercial.access"]);
    render(<AppLayout>page</AppLayout>);
    expect(location.replace).toHaveBeenCalledWith("https://ads.loopdn.com/");
  });

  it("keeps an advertiser-only account here on the desktop app", () => {
    const location = stubLocation("https://loopdn.com/chats/");
    features = new Set(["commercial.access"]);
    desktop = true;
    render(<AppLayout>page</AppLayout>);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("keeps an account with both, and waits while features load", () => {
    const location = stubLocation("https://loopdn.com/chats/");
    features = new Set(["commercial.access", "chat.access"]);
    const first = render(<AppLayout>page</AppLayout>);
    first.unmount();

    features = new Set(["commercial.access"]);
    featuresLoading = true;
    render(<AppLayout>page</AppLayout>);
    expect(location.replace).not.toHaveBeenCalled();
  });
});

describe("the chat screens", () => {
  it("opens the home shell on chats", () => {
    render(<ChatsPage />);
    expect(screen.getByTestId("home-shell")).toHaveTextContent("chat");
  });

  it("opens the home shell on broadcasts", () => {
    render(<BroadcastPage />);
    expect(screen.getByTestId("home-shell")).toHaveTextContent("broadcast");
  });

  it("sends the old home address to chats", () => {
    const { container } = render(<HomePage />);
    expect(replace).toHaveBeenCalledWith("/chats/");
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the screens still to come", () => {
  it.each([
    ["AI Assistant", AiAssistantPage],
    ["Media", MediaPage],
    ["Communities", CommunitiesPage],
    ["Contacts", ContactsPage],
    ["Starred", StarredPage],
  ])("%s says it is coming soon", (title, Page) => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { name: new RegExp(title, "i") }),
    ).toBeInTheDocument();
  });
});
