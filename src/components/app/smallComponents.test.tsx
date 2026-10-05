import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const openNavDrawer = vi.fn();
let socketListener: ((frame: Record<string, unknown>) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/app/AppShellProvider", () => ({
  useAppShell: () => ({
    openNavDrawer,
    subscribeToSocket: (listener: typeof socketListener) => {
      socketListener = listener;
      return unsubscribe;
    },
  }),
}));

import { ActivityFeedSkeleton } from "@/components/app/ActivityFeedSkeleton";
import { ActivityToasts } from "@/components/app/ActivityToasts";
import {
  dayBucket,
  presentNotification,
  timeLabel,
} from "@/components/app/activityCopy";
import { AnalyticsSkeleton } from "@/components/app/AnalyticsSkeleton";
import { ComingSoon } from "@/components/app/ComingSoon";
import { GroupResultsSkeleton } from "@/components/app/GroupResultsSkeleton";
import { LoadFailed } from "@/components/app/LoadFailed";
import { LoopdnLogo } from "@/components/app/LoopdnLogo";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { AccessIcon, SmsWebIcon, VoiceIcon } from "@/components/auth/FeatureIcons";
import { FormSkeleton, ProgressBar } from "@/components/auth/LoadingSkeletons";
import { LoadingSpinner } from "@/components/auth/LoadingSpinner";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { ConversationListSkeleton } from "@/components/home/ConversationListSkeleton";
import { NotificationBadge } from "@/components/home/NotificationBadge";
import { MessageThreadSkeleton } from "@/components/home/message/MessageThreadSkeleton";
import { SponsoredCard } from "@/components/sponsored/SponsoredCard";
import type { AppNotification } from "@/lib/chat/notifications";

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 1,
    type: "general",
    category: "general",
    actorName: "Sam",
    conversationId: 12,
    conversationName: "Book club",
    joinMode: null,
    viewerStatus: null,
    requestStatus: null,
    data: null,
    readAt: null,
    createdAt: "2026-10-05T09:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  socketListener = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loading skeletons", () => {
  it.each([
    ["Loading your activity", ActivityFeedSkeleton],
    ["Loading analytics", AnalyticsSkeleton],
    ["Searching for groups", GroupResultsSkeleton],
    ["Loading your chats", ConversationListSkeleton],
    ["Loading messages", MessageThreadSkeleton],
  ])("says %s while it stands in for the real thing", (label, Component) => {
    render(<Component />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(label);
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(3);
  });

  it("draws the auth placeholders", () => {
    const { container } = render(
      <>
        <FormSkeleton />
        <ProgressBar />
        <LoadingSpinner />
      </>,
    );
    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });
});

describe("ComingSoon", () => {
  it("names the section and offers the way back", () => {
    render(<ComingSoon title="Broadcast" description="Send to many at once." />);
    expect(screen.getByRole("heading", { name: "Broadcast" })).toBeInTheDocument();
    expect(screen.getByText("Send to many at once.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Chats" }).getAttribute("href"),
    ).toMatch(/^\/chats\/?$/);
  });
});

describe("NavDrawerButton", () => {
  it("opens the navigation drawer", () => {
    render(<NavDrawerButton className="extra" />);
    const button = screen.getByRole("button", { name: "Open navigation" });
    expect(button).toHaveClass("extra");
    fireEvent.click(button);
    expect(openNavDrawer).toHaveBeenCalledTimes(1);
  });
});

describe("LoadFailed", () => {
  it("says what failed, in the server's words when it gave any", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <LoadFailed what="your chats" message="Signed out." onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your chats");
    expect(screen.getByRole("alert")).toHaveTextContent("Signed out.");

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<LoadFailed what="your chats" onRetry={onRetry} className="mt-4" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check your connection and try again.",
    );
  });
});

describe("LoopdnLogo", () => {
  it("is one image with a name, however it is drawn", () => {
    render(<LoopdnLogo className="h-8" />);
    expect(screen.getByRole("img", { name: "Loopd'n" })).toBeInTheDocument();
  });
});

describe("feature icons", () => {
  it("draw decorative icons, hidden from assistive tech", () => {
    const { container } = render(
      <>
        <SmsWebIcon className="a" />
        <SmsWebIcon cut="#fff" />
        <VoiceIcon className="b" />
        <AccessIcon className="c" />
      </>,
    );
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(4);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden"));
    expect(icons[0].querySelector("rect")).toHaveAttribute("fill", "#9CDAF8");
    expect(icons[1].querySelector("rect")).toHaveAttribute("fill", "#fff");
  });
});

describe("ChatAvatar", () => {
  it("shows the picture when there is one", () => {
    const { container } = render(
      <ChatAvatar name="Sam" imageUrl="https://cdn.example/sam.png" size={32} />,
    );
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "https://cdn.example/sam.png");
    expect(image).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("falls back to an initial on a colour that stays the same for a name", () => {
    const { container, rerender } = render(<ChatAvatar name="  sam wren" />);
    const first = container.firstElementChild!;
    expect(first).toHaveTextContent("S");
    const tint = [...first.classList].find((name) => /^bg-\w+-500$/.test(name));
    expect(tint).toBeTruthy();

    rerender(<ChatAvatar name="  sam wren" size={64} shape="square" />);
    const second = container.firstElementChild!;
    expect(second).toHaveClass(tint!);
    expect(second).toHaveStyle({ width: "64px", borderRadius: "14px" });
    expect(second).not.toHaveClass("rounded-full");
  });

  it("uses a question mark for no name, and a group mark for a group", () => {
    const { container, rerender } = render(<ChatAvatar name="   " />);
    expect(container.firstElementChild).toHaveTextContent("?");

    rerender(<ChatAvatar name="Book club" isGroup />);
    expect(container.firstElementChild).toHaveClass("bg-brand");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("NotificationBadge", () => {
  it("shows a count, capped, and nothing for none", () => {
    const { container, rerender } = render(<NotificationBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<NotificationBadge count={7} className="ml-1" />);
    expect(container).toHaveTextContent("7");
    rerender(<NotificationBadge count={250} />);
    expect(container).toHaveTextContent("99+");
  });
});

describe("SponsoredCard", () => {
  const base = {
    companyName: "Acme",
    headline: "Half off",
    body: "This week only.",
    imageUrl: "https://cdn.example/ad.png",
    ctaLabel: "Shop now",
    ctaKind: "link" as const,
  };

  it("is marked as sponsored and links out without leaking where from", () => {
    const { container } = render(
      <SponsoredCard {...base} ctaHref="https://acme.example/offer" />,
    );
    expect(screen.getByText("Sponsored · Acme")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/ad.png",
    );
    const link = screen.getByRole("link", { name: "Shop now" });
    expect(link).toHaveAttribute("href", "https://acme.example/offer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("runs a handler instead of linking when given one", () => {
    const onCta = vi.fn();
    render(
      <SponsoredCard {...base} ctaKind="lead_form" ctaHref="https://x" onCta={onCta} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Shop now" }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("previews an unfinished ad with placeholders and a button that goes nowhere", () => {
    const { container } = render(
      <SponsoredCard
        {...base}
        headline=""
        body=""
        ctaLabel=""
        imageUrl={null}
        ctaKind="group_join"
      />,
    );
    expect(screen.getByText("Your headline")).toBeInTheDocument();
    expect(screen.getByText("What your ad says.")).toBeInTheDocument();
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("presentNotification", () => {
  it.each([
    ["join.requested", {}, "Sam requested to join", undefined],
    ["join.approved", {}, "Your request was approved", "You are now in Book club."],
    ["join.declined", {}, "Your request was declined", undefined],
    ["member.added", {}, "You were added to a group", "Added by Sam."],
    ["member.removed", {}, "You were removed from a group", undefined],
    [
      "member.removed",
      { data: { blocked: true } },
      "You were blocked from a group",
      undefined,
    ],
    ["role.granted", {}, "You were promoted to admin", "You are now an admin."],
    ["role.revoked", {}, "You are no longer an admin", undefined],
    [
      "group.mode_changed",
      {},
      "Group mode changed to Broadcast",
      "Only admins can now send messages.",
    ],
    [
      "sms.opted_out",
      {},
      "Sam opted out of SMS",
      "They texted STOP and will no longer receive SMS from this group.",
    ],
    ["sms.opted_in", {}, "Sam accepted your invitation", undefined],
    [
      "sms.send_failed",
      { data: { count: 1 } },
      "A message did not reach everyone",
      "1 person did not get it by text in Book club.",
    ],
    [
      "sms.send_failed",
      {},
      "A message did not reach everyone",
      "Text delivery failed for some members.",
    ],
    [
      "email.send_failed",
      { data: { count: 3 } },
      "A message did not reach everyone",
      "3 people did not get it by email in Book club.",
    ],
    [
      "email.send_failed",
      {},
      "A message did not reach everyone",
      "Email delivery failed for some members.",
    ],
    [
      "sms.invite_pending",
      {},
      "Invitation still pending",
      "Sam has not replied yet.",
    ],
    ["general", {}, "Something happened", undefined],
  ] as const)("%s %j", (type, overrides, title, detail) => {
    const shown = presentNotification(
      notification({ type, ...(overrides as Partial<AppNotification>) }),
    );
    expect(shown.title).toBe(title);
    expect(shown.detail).toBe(detail);
    expect(shown.icon).toBeTruthy();
    expect(shown.tone).toMatch(/^bg-/);
  });

  it("stays readable when it knows neither who nor where", () => {
    const anonymous = { actorName: null, conversationName: null };
    expect(
      presentNotification(notification({ type: "join.requested", ...anonymous }))
        .title,
    ).toBe("Someone requested to join");
    expect(
      presentNotification(notification({ type: "join.approved", ...anonymous }))
        .detail,
    ).toBe("You are now in a group.");
    expect(
      presentNotification(notification({ type: "member.added", ...anonymous }))
        .detail,
    ).toBeUndefined();
  });
});

describe("activity day buckets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
  });

  const at = (day: number) => new Date(2026, 9, day, 9, 30).toISOString();

  it("sorts a moment into today, yesterday or earlier", () => {
    expect(dayBucket(at(5))).toBe("Today");
    expect(dayBucket(at(6))).toBe("Today");
    expect(dayBucket(at(4))).toBe("Yesterday");
    expect(dayBucket(at(1))).toBe("Earlier");
    expect(dayBucket("")).toBe("Earlier");
  });

  it("labels the time to suit the bucket", () => {
    expect(timeLabel(at(5), "Today")).toMatch(/^9:30/);
    expect(timeLabel(at(4), "Yesterday")).toMatch(/^Yesterday, 9:30/);
    expect(timeLabel(at(1), "Earlier")).toMatch(/Oct 1, 9:30/);
    expect(timeLabel("", "Today")).toBe("");
  });
});

describe("ActivityToasts", () => {
  function frame(id: number, extra: object = {}) {
    return {
      type: "notification.new",
      notification: {
        id,
        type: "join.requested",
        from_user: { username: "sam" },
        conversation_name: "Book club",
        ...extra,
      },
    };
  }

  it("shows nothing until something happens", () => {
    const { container } = render(<ActivityToasts />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a notification from the socket, then lets it go", () => {
    vi.useFakeTimers();
    render(<ActivityToasts />);
    act(() => socketListener!(frame(1)));

    expect(screen.getByText("sam requested to join")).toBeInTheDocument();
    expect(screen.getByText("Book club")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("sam requested to join")).not.toBeInTheDocument();
  });

  it("ignores other frames and notifications it cannot read", () => {
    const { container } = render(<ActivityToasts />);
    act(() => {
      socketListener!({ type: "message.new", notification: { id: 1 } });
      socketListener!({ type: "notification.new", notification: { id: "x" } });
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the newest two, and one copy of a repeat", () => {
    render(<ActivityToasts />);
    act(() => {
      socketListener!(frame(1, { conversation_name: "One" }));
      socketListener!(frame(2, { conversation_name: "Two" }));
      socketListener!(frame(2, { conversation_name: "Two again" }));
      socketListener!(frame(3, { conversation_name: null }));
    });
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.queryByText("Two")).not.toBeInTheDocument();
    expect(screen.getByText("Two again")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(2);
  });

  it("opens the activity page from a toast, and dismisses from its close button", () => {
    render(<ActivityToasts />);
    act(() => {
      socketListener!(frame(1, { conversation_name: "One" }));
      socketListener!(frame(2, { conversation_name: "Two" }));
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Two"));
    expect(push).toHaveBeenCalledWith("/activity/");
    expect(screen.queryByText("Two")).not.toBeInTheDocument();
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<ActivityToasts />);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
