import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/home/CreateLoopForm", () => ({
  CreateLoopForm: ({
    onClose,
    onSuccess,
  }: {
    onClose: () => void;
    onSuccess?: (id: number) => void;
  }) => (
    <div>
      <button onClick={onClose}>form cancel</button>
      <button onClick={() => onSuccess?.(5)}>form done</button>
    </div>
  ),
}));
vi.mock("@/lib/chat/groupOptions", () => ({ fetchGroupOptions: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({
  getPendingPhone: vi.fn(),
  requestPhoneVerificationCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));
vi.mock("@/lib/chat/sponsored", () => ({
  fetchSponsoredCard: vi.fn(),
  reportSponsoredView: vi.fn(async () => {}),
  openLeadForm: vi.fn(),
  sendLead: vi.fn(),
}));
vi.mock("@/components/sponsored/SponsoredCard", () => ({
  SponsoredCard: ({
    headline,
    ctaLabel,
    ctaHref,
    onCta,
  }: {
    headline: string;
    ctaLabel: string;
    ctaHref?: string;
    onCta?: () => void;
  }) => (
    <div>
      <p>{headline}</p>
      {onCta ? (
        <button onClick={onCta}>{ctaLabel}</button>
      ) : (
        <a href={ctaHref}>{ctaLabel}</a>
      )}
    </div>
  ),
}));
vi.mock("@/components/settings/AvatarPicker", () => ({
  AvatarPicker: ({
    currentUrl,
    file,
    onPick,
    onReject,
    onRemove,
  }: {
    currentUrl: string | null;
    file: File | null;
    onPick: (file: File) => void;
    onReject: (message: string) => void;
    onRemove: () => void;
  }) => (
    <div data-testid="avatar-picker">
      <span>{file ? `new:${file.name}` : (currentUrl ?? "no picture")}</span>
      <button type="button" onClick={() => onPick(new File(["x"], "logo.png"))}>
        pick picture
      </button>
      <button type="button" onClick={() => onReject("That file is too big.")}>
        pick bad picture
      </button>
      <button type="button" onClick={onRemove}>
        remove picture
      </button>
    </div>
  ),
}));

import { CreateLoopModal } from "@/components/home/CreateLoopModal";
import { JoinLoopModal } from "@/components/home/JoinLoopModal";
import { LeadFormModal } from "@/components/home/LeadFormModal";
import { LoopCommunicationMode } from "@/components/home/LoopCommunicationMode";
import { LoopDetailsForm } from "@/components/home/LoopDetailsForm";
import { LoopKindAndPlace } from "@/components/home/LoopKindAndPlace";
import { LoopMessagingInterface } from "@/components/home/LoopMessagingInterface";
import { MemberChannelConsent } from "@/components/home/MemberChannelConsent";
import {
  commitPendingMember,
  MembersField,
} from "@/components/home/MembersField";
import {
  SponsoredSlot,
  useSponsoredSlot,
} from "@/components/home/SponsoredSlot";
import { VerifyPhoneModal } from "@/components/home/VerifyPhoneModal";
import {
  getPendingPhone,
  requestPhoneVerificationCode,
  verifyPhoneCode,
} from "@/lib/auth/client";
import { fetchGroupOptions } from "@/lib/chat/groupOptions";
import type { MemberEntry } from "@/lib/chat/members";
import {
  fetchSponsoredCard,
  openLeadForm,
  reportSponsoredView,
  sendLead,
  type SponsoredCardData,
} from "@/lib/chat/sponsored";
import { deferred } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CreateLoopModal", () => {
  it("holds the create form, passing on how it ends", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<CreateLoopModal isOpen onClose={onClose} onSuccess={onSuccess} />);
    expect(
      screen.getByRole("dialog", { name: "Create a Loop" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "form done" }));
    expect(onSuccess).toHaveBeenCalledWith(5);
    await userEvent.click(screen.getByRole("button", { name: "form cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows nothing while closed", () => {
    render(<CreateLoopModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("JoinLoopModal", () => {
  it("shows nothing while closed", () => {
    const { container } = render(
      <JoinLoopModal isOpen={false} onClose={vi.fn()} onJoin={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("joins with the trimmed code, then closes", async () => {
    const onClose = vi.fn();
    const answer = deferred<"joined" | "pending">();
    const onJoin = vi.fn(() => answer.promise);
    render(<JoinLoopModal isOpen onClose={onClose} onJoin={onJoin} />);
    const submit = screen.getByRole("button", { name: "Join Loop" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Join code"), " 7f3k ");
    await userEvent.click(submit);
    expect(onJoin).toHaveBeenCalledWith("7f3k");
    expect(screen.getByRole("button", { name: "Joining..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await act(async () => answer.resolve("joined"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says a request was sent when the Loop needs approval", async () => {
    const onClose = vi.fn();
    render(
      <JoinLoopModal
        isOpen
        onClose={onClose}
        onJoin={vi.fn(async () => "pending" as const)}
      />,
    );
    await userEvent.type(screen.getByLabelText("Join code"), "7F3K{Enter}");
    expect(await screen.findByText(/Request sent\./)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("says why the code was refused", async () => {
    const onJoin = vi
      .fn()
      .mockRejectedValueOnce(new Error("That code has expired."))
      .mockRejectedValueOnce("nope");
    render(<JoinLoopModal isOpen onClose={vi.fn()} onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText("Join code"), "7F3K{Enter}");
    expect(
      await screen.findByText("That code has expired."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Join Loop" }));
    expect(
      await screen.findByText("Unable to join this Loop."),
    ).toBeInTheDocument();
  });

  it("wants a code before it asks", () => {
    const onJoin = vi.fn();
    render(<JoinLoopModal isOpen onClose={vi.fn()} onJoin={onJoin} />);
    fireEvent.submit(document.getElementById("join-loop-form")!);
    expect(screen.getByText("Enter a join code.")).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("forgets what was typed when it is cancelled", async () => {
    const onClose = vi.fn();
    render(<JoinLoopModal isOpen onClose={onClose} onJoin={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Join code"), "7F3K");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText("Join code")).toHaveValue("");
  });
});

describe("MemberChannelConsent", () => {
  const state = (
    status: "pending" | "opted_in" | "declined" | "opted_out" | null,
    times: Partial<{
      askedAt: string;
      consentedAt: string;
      optedOutAt: string;
    }> = {},
  ) => ({
    status,
    allowsDelivery: status === "opted_in",
    askedAt: null,
    consentedAt: null,
    optedOutAt: null,
    canNudge: false,
    ...times,
  });

  it("shows nothing for a member who was never asked", () => {
    const { container } = render(
      <MemberChannelConsent channels={{ sms: state(null) }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows where a member stands on each channel they were asked about", () => {
    render(
      <MemberChannelConsent
        channels={{
          sms: state("opted_in", {
            askedAt: "2026-03-01T10:00:00.000Z",
            consentedAt: "2026-03-02T10:00:00.000Z",
          }),
          email: state("pending", { askedAt: "not a date" }),
          voice: state("opted_out", { optedOutAt: "2026-03-03T10:00:00.000Z" }),
          push: state("declined"),
          fax: state("mystery" as never),
          carrier: state(null),
        }}
      />,
    );
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    const sms = screen.getByTitle(/^SMS: Agreed to receive this channel/);
    expect(sms).toHaveTextContent(/^SMS$/);
    expect(sms.getAttribute("title")).toMatch(/\nAsked .+\nAgreed .+/);
    // A time that cannot be read is left out rather than shown wrong.
    expect(screen.getByTitle(/^Email: Asked, no answer yet/)).toHaveAttribute(
      "title",
      "Email: Asked, no answer yet — nothing is sent until they agree",
    );
    expect(screen.getByTitle(/^Email/)).toHaveTextContent("Email pending");
    expect(screen.getByTitle(/^Voice: Opted out/)).toHaveTextContent(
      "Voice stopped",
    );
    expect(screen.getByTitle(/^Voice/).getAttribute("title")).toMatch(
      /\nOpted out /,
    );
    // A channel this build has no name for is shown by its own.
    expect(screen.getByTitle(/^push: Said no/)).toHaveTextContent(
      "push declined",
    );
    // An unknown state reads as the cautious one.
    expect(screen.getByTitle(/^fax: Said no/)).toBeInTheDocument();
    expect(screen.queryByTitle(/^carrier/)).not.toBeInTheDocument();
  });
});

describe("LoopKindAndPlace", () => {
  const OPTIONS = {
    categories: [{ slug: "sports", label: "Sports" }],
    countries: [
      {
        code: "PH",
        name: "Philippines",
        regions: [{ code: "PH-00", name: "Metro Manila" }],
      },
      { code: "US", name: "United States", regions: [] },
    ],
  };

  function show(props: Partial<Parameters<typeof LoopKindAndPlace>[0]> = {}) {
    const onCategory = vi.fn();
    const onRegion = vi.fn();
    render(
      <LoopKindAndPlace
        category={null}
        region=""
        onCategory={onCategory}
        onRegion={onRegion}
        {...props}
      />,
    );
    return { onCategory, onRegion };
  }

  it("is held until the choices arrive", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchGroupOptions>>>();
    vi.mocked(fetchGroupOptions).mockReturnValue(pending.promise);
    show();
    expect(screen.getByLabelText("Kind of group")).toBeDisabled();
    expect(screen.getByLabelText("Country")).toBeDisabled();

    await act(async () => pending.resolve({ ok: true, data: OPTIONS }));
    expect(screen.getByLabelText("Kind of group")).toBeEnabled();
    expect(screen.getByLabelText("Country")).toBeEnabled();
    // No country yet, so there is no region to choose.
    expect(screen.getByLabelText("Region")).toBeDisabled();
    expect(screen.getByLabelText("Region")).toHaveTextContent(
      "Choose a country first",
    );
  });

  it("says when the choices cannot be loaded", async () => {
    vi.mocked(fetchGroupOptions).mockResolvedValue({
      ok: false,
      message: "down",
    } as never);
    show();
    expect(
      await screen.findByText(/Couldn't load the choices/),
    ).toBeInTheDocument();
  });

  it("reports the kind chosen, and null when it is cleared", async () => {
    vi.mocked(fetchGroupOptions).mockResolvedValue({ ok: true, data: OPTIONS });
    const { onCategory } = show({ category: "sports" });
    await waitFor(() =>
      expect(screen.getByLabelText("Kind of group")).toHaveValue("sports"),
    );
    await userEvent.selectOptions(screen.getByLabelText("Kind of group"), "");
    expect(onCategory).toHaveBeenCalledWith(null);
    await userEvent.selectOptions(
      screen.getByLabelText("Kind of group"),
      "sports",
    );
    expect(onCategory).toHaveBeenLastCalledWith("sports");
  });

  it("offers the regions of the chosen country", async () => {
    vi.mocked(fetchGroupOptions).mockResolvedValue({ ok: true, data: OPTIONS });
    const { onRegion } = show({ region: "PH-00" });
    await waitFor(() =>
      expect(screen.getByLabelText("Country")).toHaveValue("PH"),
    );
    const region = screen.getByLabelText("Region");
    expect(region).toHaveValue("PH-00");
    expect(region).toHaveTextContent("The whole countryMetro Manila");

    await userEvent.selectOptions(region, "PH");
    expect(onRegion).toHaveBeenCalledWith("PH");
    await userEvent.selectOptions(screen.getByLabelText("Country"), "US");
    expect(onRegion).toHaveBeenLastCalledWith("US");
  });

  it("holds each choice while it is being saved, or when it may not be changed", async () => {
    vi.mocked(fetchGroupOptions).mockResolvedValue({ ok: true, data: OPTIONS });
    const first = render(
      <LoopKindAndPlace
        category={null}
        region="XX"
        categoryBusy
        regionBusy
        onCategory={vi.fn()}
        onRegion={vi.fn()}
      />,
    );
    await waitFor(() => expect(fetchGroupOptions).toHaveBeenCalled());
    expect(screen.getByLabelText("Kind of group")).toBeDisabled();
    expect(screen.getByLabelText("Country")).toBeDisabled();
    expect(screen.getByLabelText("Region")).toBeDisabled();
    first.unmount();

    show({ disabled: true });
    await waitFor(() => expect(fetchGroupOptions).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Kind of group")).toBeDisabled();
  });

  it("ignores choices that arrive after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchGroupOptions>>>();
    vi.mocked(fetchGroupOptions).mockReturnValue(pending.promise);
    const { unmount, container } = render(
      <LoopKindAndPlace
        category={null}
        region=""
        onCategory={vi.fn()}
        onRegion={vi.fn()}
      />,
    );
    unmount();
    pending.resolve({ ok: true, data: OPTIONS });
    await pending.promise;
    expect(container).toBeEmptyDOMElement();
  });
});

describe("VerifyPhoneModal", () => {
  beforeEach(() => {
    vi.mocked(getPendingPhone).mockReturnValue("+14155552671");
    vi.mocked(requestPhoneVerificationCode).mockResolvedValue({
      ok: true,
    } as never);
  });

  it("sends a code as it opens, then verifies what is typed", async () => {
    const sending = deferred<{ ok: true }>();
    vi.mocked(requestPhoneVerificationCode).mockReturnValue(
      sending.promise as never,
    );
    const verifying = deferred<{ ok: true }>();
    vi.mocked(verifyPhoneCode).mockReturnValue(verifying.promise as never);
    const onVerified = vi.fn();
    render(<VerifyPhoneModal onVerified={onVerified} onClose={vi.fn()} />);

    expect(
      screen.getByText("Sending a verification code to +14155552671..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    expect(requestPhoneVerificationCode).toHaveBeenCalledWith("+14155552671");

    await act(async () => sending.resolve({ ok: true }));
    expect(
      screen.getByText("We sent a code to +14155552671."),
    ).toBeInTheDocument();
    const verify = screen.getByRole("button", { name: "Verify" });
    expect(verify).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("123456"), "123456");
    await userEvent.click(verify);
    expect(verifyPhoneCode).toHaveBeenCalledWith("123456");
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();

    await act(async () => verifying.resolve({ ok: true }));
    expect(onVerified).toHaveBeenCalled();
  });

  it("says when the code is wrong", async () => {
    vi.mocked(verifyPhoneCode).mockResolvedValue({
      ok: false,
      message: "That code is not right.",
    } as never);
    const onVerified = vi.fn();
    render(<VerifyPhoneModal onVerified={onVerified} onClose={vi.fn()} />);
    await userEvent.type(
      await screen.findByPlaceholderText("123456"),
      "000000{Enter}",
    );
    expect(
      await screen.findByText("That code is not right."),
    ).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("says when the code could not be sent, and sends another on request", async () => {
    vi.mocked(requestPhoneVerificationCode).mockResolvedValueOnce({
      ok: false,
      message: "Too many attempts.",
    } as never);
    render(<VerifyPhoneModal onVerified={vi.fn()} onClose={vi.fn()} />);
    expect(
      (await screen.findAllByText("Too many attempts.")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("123456")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(
      await screen.findByText("We sent a new code to +14155552671."),
    ).toBeInTheDocument();

    vi.mocked(requestPhoneVerificationCode).mockResolvedValueOnce({
      ok: false,
      message: "Still too many.",
    } as never);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(
      (await screen.findAllByText("Still too many.")).length,
    ).toBeGreaterThan(0);
  });

  it("has nothing to verify without a pending phone", () => {
    vi.mocked(getPendingPhone).mockReturnValue(null as never);
    render(<VerifyPhoneModal onVerified={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByText(/We couldn't find a pending phone number/),
    ).toBeInTheDocument();
    expect(requestPhoneVerificationCode).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Resend|Sending/ }),
    ).not.toBeInTheDocument();
  });

  it("ignores an answer that arrives after it has closed", async () => {
    const sending = deferred<{ ok: true }>();
    vi.mocked(requestPhoneVerificationCode).mockReturnValue(
      sending.promise as never,
    );
    const { unmount } = render(
      <VerifyPhoneModal onVerified={vi.fn()} onClose={vi.fn()} />,
    );
    unmount();
    sending.resolve({ ok: true });
    await sending.promise;
    expect(screen.queryByText(/We sent a code/)).not.toBeInTheDocument();
  });
});

const CARD: SponsoredCardData = {
  token: "view-token",
  companyName: "Acme",
  headline: "Try Acme",
  body: "It is good.",
  imageUrl: null,
  ctaLabel: "Learn more",
  ctaKind: "link" as never,
  clickUrl: "https://loopdn.com/c/abc/",
  formToken: null,
};

describe("useSponsoredSlot", () => {
  it("asks for a card once a group has a message, and pins it under the newest", async () => {
    vi.mocked(fetchSponsoredCard).mockResolvedValue({ ok: true, data: CARD });
    const { result } = renderHook(() =>
      useSponsoredSlot({ conversationId: 7, isGroup: true, lastMessageId: 40 }),
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(fetchSponsoredCard).toHaveBeenCalledWith("7");
    expect(result.current).toEqual({
      conversationId: "7",
      card: CARD,
      afterMessageId: "40",
    });
  });

  it("pins the card under the message that was newest when it arrived", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchSponsoredCard>>>();
    vi.mocked(fetchSponsoredCard).mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(
      (lastMessageId: number) =>
        useSponsoredSlot({ conversationId: 7, isGroup: true, lastMessageId }),
      { initialProps: 40 },
    );
    rerender(41);
    await act(async () => pending.resolve({ ok: true, data: CARD }));
    expect(result.current?.afterMessageId).toBe("41");
    expect(fetchSponsoredCard).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "no conversation",
      { conversationId: null, isGroup: true, lastMessageId: 1 },
    ],
    ["a direct chat", { conversationId: 7, isGroup: false, lastMessageId: 1 }],
    [
      "an empty thread",
      { conversationId: 7, isGroup: true, lastMessageId: null },
    ],
  ])("asks for nothing with %s", (_, props) => {
    const { result } = renderHook(() => useSponsoredSlot(props));
    expect(result.current).toBeNull();
    expect(fetchSponsoredCard).not.toHaveBeenCalled();
  });

  it("shows nothing when there is no card to show", async () => {
    vi.mocked(fetchSponsoredCard).mockResolvedValue({ ok: true, data: null });
    const { result } = renderHook(() =>
      useSponsoredSlot({ conversationId: 7, isGroup: true, lastMessageId: 40 }),
    );
    await waitFor(() => expect(fetchSponsoredCard).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("drops one conversation's card on moving to another", async () => {
    vi.mocked(fetchSponsoredCard).mockResolvedValueOnce({
      ok: true,
      data: CARD,
    });
    const next = deferred<Awaited<ReturnType<typeof fetchSponsoredCard>>>();
    vi.mocked(fetchSponsoredCard).mockReturnValueOnce(next.promise);
    const { result, rerender, unmount } = renderHook(
      (conversationId: number) =>
        useSponsoredSlot({ conversationId, isGroup: true, lastMessageId: 40 }),
      { initialProps: 7 },
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    rerender(8);
    expect(result.current).toBeNull();

    // An answer for a thread that has been left is not shown.
    unmount();
    next.resolve({ ok: true, data: CARD });
    await next.promise;
    expect(result.current).toBeNull();
  });
});

describe("SponsoredSlot", () => {
  let seen: (entries: { intersectionRatio: number }[]) => void;
  const disconnect = vi.fn();
  let visibility: "visible" | "hidden";

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof seen) {
          seen = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
  });

  function setVisibility(next: typeof visibility) {
    visibility = next;
    document.dispatchEvent(new Event("visibilitychange"));
  }

  it("counts a view once half the card has been on screen for a second", () => {
    render(<SponsoredSlot card={CARD} />);
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "https://loopdn.com/c/abc/",
    );
    act(() => seen([{ intersectionRatio: 0.6 }]));
    // A second sighting while the clock runs starts no second clock.
    act(() => seen([{ intersectionRatio: 1 }]));
    vi.advanceTimersByTime(999);
    expect(reportSponsoredView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reportSponsoredView).toHaveBeenCalledTimes(1);
    expect(reportSponsoredView).toHaveBeenCalledWith("view-token");

    // Counted once, however often it comes back into view.
    act(() => seen([{ intersectionRatio: 1 }]));
    vi.advanceTimersByTime(5000);
    expect(reportSponsoredView).toHaveBeenCalledTimes(1);
  });

  it("does not count a card that scrolls away within the second", () => {
    render(<SponsoredSlot card={CARD} />);
    act(() => seen([{ intersectionRatio: 0.6 }]));
    vi.advanceTimersByTime(500);
    act(() => seen([{ intersectionRatio: 0.2 }]));
    vi.advanceTimersByTime(5000);
    expect(reportSponsoredView).not.toHaveBeenCalled();
  });

  it("does not count while the tab is hidden, and resumes when it returns", () => {
    render(<SponsoredSlot card={CARD} />);
    setVisibility("hidden");
    act(() => seen([{ intersectionRatio: 1 }]));
    vi.advanceTimersByTime(5000);
    expect(reportSponsoredView).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(500);
    setVisibility("hidden");
    vi.advanceTimersByTime(5000);
    expect(reportSponsoredView).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(reportSponsoredView).toHaveBeenCalledTimes(1);
  });

  it("stops watching when it goes", () => {
    const { unmount } = render(<SponsoredSlot card={CARD} />);
    act(() => seen([{ intersectionRatio: 1 }]));
    unmount();
    vi.advanceTimersByTime(5000);
    expect(disconnect).toHaveBeenCalled();
    expect(reportSponsoredView).not.toHaveBeenCalled();
  });

  it("opens Loopd'n's own form for a lead card", async () => {
    vi.useRealTimers();
    vi.mocked(openLeadForm).mockResolvedValue({
      ok: false,
      message: "This form has closed.",
    } as never);
    render(
      <SponsoredSlot
        card={{ ...CARD, clickUrl: null, formToken: "form-token" }}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Learn more" }));
    expect(openLeadForm).toHaveBeenCalledWith("form-token");
    expect(
      await screen.findByText("This form has closed."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LeadFormModal", () => {
  const FORM = {
    companyName: "Acme",
    headline: "Get a quote",
    fields: {
      name: "Sam Wren",
      phone: "+14155552671",
      email: "sam@example.com",
    },
    consent: "Acme will contact you about this.",
    alreadySent: false,
  };

  function formIs(form: typeof FORM = FORM) {
    vi.mocked(openLeadForm).mockResolvedValue({
      ok: true,
      data: form,
    } as never);
  }

  it("does not open the form until it is shown", () => {
    render(<LeadFormModal formToken="t" isOpen={false} onClose={vi.fn()} />);
    expect(openLeadForm).not.toHaveBeenCalled();
  });

  it("fills in what the member already has, and sends what they leave", async () => {
    formIs();
    const sending = deferred<{ ok: true }>();
    vi.mocked(sendLead).mockReturnValue(sending.promise as never);
    const onClose = vi.fn();
    render(<LeadFormModal formToken="t" isOpen onClose={onClose} />);
    expect(
      screen.getByRole("dialog", { name: "Send your details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    expect(
      await screen.findByRole("dialog", { name: "Get a quote" }),
    ).toHaveTextContent("To Acme");
    expect(screen.getByLabelText("Name")).toHaveValue("Sam Wren");
    expect(
      screen.getByText("Acme will contact you about this."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Message (optional)"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sendLead).toHaveBeenCalledWith("t", {
      name: "Sam Wren",
      phone: "+14155552671",
      email: "sam@example.com",
      message: "Hi",
    });
    // Nothing can be sent twice, or abandoned, while it is on its way.
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => sending.resolve({ ok: true }));
    expect(
      screen.getByText("Sent. Acme will get in touch with you."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("wants a name and a way to be reached", async () => {
    formIs({ ...FORM, fields: { name: "", phone: "", email: "" } });
    render(<LeadFormModal formToken="t" isOpen onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(
      screen.getByText(/Give a phone number or an email address/),
    ).toBeInTheDocument();
    expect(sendLead).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    expect(screen.queryByText("Enter your name.")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    vi.mocked(sendLead).mockResolvedValue({ ok: true } as never);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/^Sent\./)).toBeInTheDocument();
  });

  it("puts each refusal under the field it is about", async () => {
    formIs();
    vi.mocked(sendLead).mockResolvedValue({
      ok: false,
      message: "Check the form.",
      fieldErrors: { phone: "Not a phone number.", email: "Not an email." },
    } as never);
    render(<LeadFormModal formToken="t" isOpen onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(await screen.findByText("Not a phone number.")).toBeInTheDocument();
    expect(screen.getByText("Not an email.")).toBeInTheDocument();
    expect(screen.queryByText("Check the form.")).not.toBeInTheDocument();
  });

  it("shows a refusal about nothing in particular above the form", async () => {
    formIs();
    vi.mocked(sendLead).mockResolvedValue({
      ok: false,
      message: "This campaign has ended.",
    } as never);
    render(<LeadFormModal formToken="t" isOpen onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("This campaign has ended."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Phone"), "1");
    expect(
      screen.queryByText("This campaign has ended."),
    ).not.toBeInTheDocument();
  });

  it("says when the details were already sent", async () => {
    formIs({ ...FORM, alreadySent: true });
    render(<LeadFormModal formToken="t" isOpen onClose={vi.fn()} />);
    expect(
      await screen.findByText(
        "You've already sent your details to Acme for this.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();
  });

  it("ignores a form that arrives after it has gone", async () => {
    const pending = deferred<unknown>();
    vi.mocked(openLeadForm).mockReturnValue(pending.promise as never);
    const { unmount } = render(
      <LeadFormModal formToken="t" isOpen onClose={vi.fn()} />,
    );
    unmount();
    pending.resolve({ ok: true, data: FORM });
    await pending.promise;
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LoopCommunicationMode", () => {
  it("describes a chat group, and switches it to broadcast", async () => {
    const answer = deferred<void>();
    const onModeChange = vi.fn(() => answer.promise);
    render(
      <LoopCommunicationMode
        loopName="Book Club"
        currentMode="chat"
        onModeChange={onModeChange}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Members can communicate with everyone/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chat Group/ })).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: /Broadcast Group/ }),
    );
    expect(onModeChange).toHaveBeenCalledWith("broadcast", "private");
    expect(screen.getByText("Updating mode...")).toBeInTheDocument();

    await act(async () => answer.resolve());
    expect(screen.queryByText("Updating mode...")).not.toBeInTheDocument();
  });

  it.each([
    ["private", "Members can only reply privately to admins"],
    ["group_wide", "Members can reply to everyone in the group"],
    ["disabled", "Members cannot reply; receive announcements only"],
  ] as const)("describes %s replies to a broadcast", (replyMode, copy) => {
    render(
      <LoopCommunicationMode
        loopName="News"
        currentMode="broadcast"
        broadcastReplyMode={replyMode}
      />,
    );
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Broadcast Group/ }),
    ).toBeDisabled();
  });

  it("switches a broadcast back to chat, saying why when it fails", async () => {
    const onModeChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("Only admins can do that."))
      .mockRejectedValueOnce("nope");
    render(
      <LoopCommunicationMode
        loopName="News"
        currentMode="broadcast"
        onModeChange={onModeChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Chat Group/ }));
    expect(onModeChange).toHaveBeenCalledWith("chat", undefined);
    expect(
      await screen.findByText("Only admins can do that."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Chat Group/ }));
    expect(
      await screen.findByText("Failed to update communication mode"),
    ).toBeInTheDocument();
  });

  it("copes with nobody listening for the change", async () => {
    render(<LoopCommunicationMode loopName="News" currentMode="broadcast" />);
    await userEvent.click(screen.getByRole("button", { name: /Chat Group/ }));
    expect(screen.queryByText("Updating mode...")).not.toBeInTheDocument();
  });

  it("holds both choices while loading", () => {
    render(
      <LoopCommunicationMode loopName="News" currentMode="chat" isLoading />,
    );
    expect(
      screen.getByRole("button", { name: /Broadcast Group/ }),
    ).toBeDisabled();
  });

  it("tells a member that only admins can change the mode", () => {
    render(
      <LoopCommunicationMode
        loopName="News"
        currentMode="chat"
        canChangeMode={false}
      />,
    );
    expect(
      screen.getByText(/Only admins can change the communication mode/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LoopMessagingInterface", () => {
  const messages = [
    { id: 1, sender: "Ada", text: "Hello", mine: false, time: "10:00" },
    { id: 2, sender: "You", text: "Hi", mine: true, time: "10:01" },
    {
      id: 3,
      sender: "Ada",
      text: "Meeting at noon",
      mine: false,
      time: "10:02",
      type: "announcement" as const,
      replyMode: "private" as const,
    },
    {
      id: 4,
      sender: "Ada",
      text: "Second",
      mine: false,
      time: "10:03",
      type: "announcement" as const,
      replyMode: "group_wide" as const,
    },
    {
      id: 5,
      sender: "Ada",
      text: "Third",
      mine: false,
      time: "10:04",
      type: "announcement" as const,
      replyMode: "disabled" as const,
    },
    {
      id: 6,
      sender: "You",
      text: "Mine",
      mine: true,
      time: "10:05",
      type: "announcement" as const,
    },
  ];

  it("sends the trimmed message from the button or the Enter key", async () => {
    const onSendMessage = vi.fn(async () => {});
    render(
      <LoopMessagingInterface
        messages={messages}
        mode="chat"
        onSendMessage={onSendMessage}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getAllByText("📢 Announcement")).toHaveLength(3);
    // How to reply is only said in a broadcast.
    expect(
      screen.queryByText("💬 Reply privately to admins"),
    ).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText("Type your message...");
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await userEvent.type(input, "  hello  ");
    await userEvent.click(send);
    expect(onSendMessage).toHaveBeenCalledWith("hello");
    expect(input).toHaveValue("");

    await userEvent.type(input, "again{Enter}");
    expect(onSendMessage).toHaveBeenLastCalledWith("again");
    await userEvent.type(input, "   {Enter}");
    expect(onSendMessage).toHaveBeenCalledTimes(2);
  });

  it("sends nothing while loading, and copes with nobody listening", async () => {
    const onSendMessage = vi.fn();
    const first = render(
      <LoopMessagingInterface
        messages={[]}
        mode="chat"
        onSendMessage={onSendMessage}
        isLoading
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText("Type your message..."),
      "hello{Enter}",
    );
    expect(onSendMessage).not.toHaveBeenCalled();
    first.unmount();

    render(<LoopMessagingInterface messages={[]} mode="chat" />);
    const input = screen.getByPlaceholderText("Type your message...");
    await userEvent.type(input, "hello{Enter}");
    expect(input).toHaveValue("");
  });

  it("says how each announcement may be answered in a broadcast", () => {
    render(<LoopMessagingInterface messages={messages} mode="broadcast" />);
    expect(
      screen.getByText("💬 Reply privately to admins"),
    ).toBeInTheDocument();
    expect(screen.getByText("💬 Reply to everyone")).toBeInTheDocument();
    expect(screen.getByText("❌ No replies allowed")).toBeInTheDocument();
    expect(screen.getByText("📢 BROADCAST MODE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send Announcement" }),
    ).toBeEnabled();
  });
});

describe("MembersField", () => {
  function show(value: MemberEntry[] = [], disabled = false) {
    const onChange = vi.fn();
    const onPendingChange = vi.fn();
    render(
      <MembersField
        value={value}
        onChange={onChange}
        onPendingChange={onPendingChange}
        disabled={disabled}
      />,
    );
    return {
      onChange,
      onPendingChange,
      input: screen.getByLabelText("Members"),
    };
  }
  const sam: MemberEntry = { raw: "@sam", value: "sam", kind: "username" };
  const ada: MemberEntry = {
    raw: "ada@example.com",
    value: "ada@example.com",
    kind: "email",
  };

  it("adds a person on Enter or a comma, clearing the draft", async () => {
    const { onChange, onPendingChange, input } = show();
    await userEvent.type(input, "@sam{Enter}");
    expect(onChange).toHaveBeenCalledWith([sam]);
    expect(input).toHaveValue("");
    expect(onPendingChange).toHaveBeenLastCalledWith("");

    await userEvent.type(input, "Ada@Example.com,");
    expect(onChange).toHaveBeenLastCalledWith([
      { raw: "Ada@Example.com", value: "ada@example.com", kind: "email" },
    ]);
  });

  it("shows who is added, by kind, and removes one on request", async () => {
    const { onChange, input } = show([sam, ada]);
    expect(screen.getByText("Username:").parentElement).toHaveTextContent(
      "Username: @sam",
    );
    expect(screen.getByText("Email:").parentElement).toHaveTextContent(
      "Email: ada@example.com",
    );
    expect(input).not.toHaveAttribute(
      "placeholder",
      expect.stringMatching(/./),
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove @sam" }));
    expect(onChange).toHaveBeenCalledWith([ada]);
  });

  it("removes the last person on Backspace in an empty field", async () => {
    const { onChange, input } = show([sam, ada]);
    await userEvent.type(input, "{Backspace}");
    expect(onChange).toHaveBeenCalledWith([sam]);
  });

  it("keeps what it cannot read in the field, and says why", async () => {
    const { onChange, input } = show();
    await userEvent.type(input, "@!!{Enter}");
    expect(
      screen.getByText('"@!!" is not a valid username.'),
    ).toBeInTheDocument();
    expect(input).toHaveValue("@!!");
    expect(onChange).not.toHaveBeenCalled();

    // Typing again clears the complaint.
    await userEvent.type(input, "x");
    expect(
      screen.queryByText(/is not a valid username/),
    ).not.toBeInTheDocument();
  });

  it("takes a pasted list, keeping the good and counting the bad", () => {
    const { onChange, input } = show([sam]);
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "@sam\n@lin; @!!, @??, @LIN, ada@example.com",
      },
    });
    expect(onChange).toHaveBeenCalledWith([
      sam,
      { raw: "@lin", value: "lin", kind: "username" },
      ada,
    ]);
    expect(input).toHaveValue("@!!, @??");
    expect(
      screen.getByText("2 entries were not recognised. Fix or remove them."),
    ).toBeInTheDocument();
  });

  it("leaves a pasted single entry to be typed on", () => {
    const { onChange, input } = show();
    const notPrevented = fireEvent.paste(input, {
      clipboardData: { getData: () => "@sam" },
    });
    expect(notPrevented).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds what is still in the field when it loses focus", async () => {
    const { onChange, input } = show();
    await userEvent.type(input, "@sam");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith([sam]);
  });

  it("does nothing on leaving an empty field", async () => {
    const { onChange, input } = show();
    await userEvent.click(input);
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("focuses the input when its box is clicked", async () => {
    const { input } = show([sam]);
    await userEvent.click(input.parentElement as HTMLElement);
    expect(input).toHaveFocus();
  });

  it("can be held, chips and all", () => {
    const { input } = show([sam], true);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove @sam" })).toBeDisabled();
  });

  it("works without anybody watching the draft", async () => {
    const onChange = vi.fn();
    render(<MembersField value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Members"), "@sam{Enter}");
    expect(onChange).toHaveBeenCalledWith([sam]);
  });
});

describe("commitPendingMember", () => {
  const sam: MemberEntry = { raw: "@sam", value: "sam", kind: "username" };

  it("adds what was still being typed, without repeating anybody", () => {
    expect(commitPendingMember("@sam, @lin", [sam])).toEqual({
      entries: [sam, { raw: "@lin", value: "lin", kind: "username" }],
      error: "",
    });
    expect(commitPendingMember("  ", [sam])).toEqual({
      entries: [sam],
      error: "",
    });
  });

  it("stops at the first entry it cannot read", () => {
    expect(commitPendingMember("@lin, @!!, @kim", [])).toEqual({
      entries: [{ raw: "@lin", value: "lin", kind: "username" }],
      error: '"@!!" is not a valid username.',
    });
  });
});

describe("LoopDetailsForm", () => {
  function show(props: Partial<Parameters<typeof LoopDetailsForm>[0]> = {}) {
    const onSave = vi.fn(async () => {});
    const view = render(
      <LoopDetailsForm
        name="Book Club"
        description="We read."
        imageUrl="https://cdn.example/logo.png"
        canEdit
        onSave={onSave}
        {...props}
      />,
    );
    return { onSave, ...view };
  }

  it("is read-only for somebody who may not edit", () => {
    show({ canEdit: false });
    expect(screen.getByLabelText("Loop Name")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.queryByTestId("avatar-picker")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/JPG or PNG/)).not.toBeInTheDocument();
  });

  it("saves only what changed, trimmed", async () => {
    const { onSave } = show();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("8/280")).toBeInTheDocument();

    const name = screen.getByLabelText("Loop Name");
    await userEvent.clear(name);
    await userEvent.type(name, "  Readers  ");
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ name: "Readers" });
  });

  it("says Saved once the change has landed", async () => {
    const answer = deferred<void>();
    const onSave = vi.fn(() => answer.promise);
    const { rerender } = render(
      <LoopDetailsForm
        name="Book Club"
        description="We read."
        imageUrl={null}
        canEdit
        onSave={onSave}
      />,
    );
    const description = screen.getByLabelText("Description");
    await userEvent.type(description, " A lot.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ description: "We read. A lot." });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(description).toBeDisabled();

    await act(async () => answer.resolve());
    // The saved value comes back down as the new prop.
    rerender(
      <LoopDetailsForm
        name="Book Club"
        description="We read. A lot."
        imageUrl={null}
        canEdit
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("refuses a name or a description that breaks the rules", async () => {
    const { onSave } = show();
    const name = screen.getByLabelText("Loop Name");
    await userEvent.clear(name);
    await userEvent.type(name, "ab{Enter}");
    expect(
      screen.getByText("Loop name must be at least 3 characters"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(name).toHaveValue("Book Club");
    expect(
      screen.queryByText("Loop name must be at least 3 characters"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "x".repeat(281) },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Description must be 280 characters or less"),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a new picture, or the removal of the old one", async () => {
    const { onSave } = show();
    await userEvent.click(screen.getByRole("button", { name: "pick picture" }));
    expect(screen.getByText("new:logo.png")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ image: expect.any(File) });
    await waitFor(() =>
      expect(
        screen.getByText("https://cdn.example/logo.png"),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "remove picture" }),
    );
    expect(screen.getByText("no picture")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith({ image: null });
  });

  it("has nothing to save on removing a picture that was never there", async () => {
    show({ imageUrl: null });
    await userEvent.click(
      screen.getByRole("button", { name: "remove picture" }),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows why a picture was refused, until a good one is picked", async () => {
    show();
    await userEvent.click(
      screen.getByRole("button", { name: "pick bad picture" }),
    );
    expect(screen.getByText("That file is too big.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "pick picture" }));
    expect(screen.queryByText("That file is too big.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      screen.getByText("https://cdn.example/logo.png"),
    ).toBeInTheDocument();
  });

  it("says why a save failed, and keeps the draft", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("That name is taken."))
      .mockRejectedValueOnce(new Error(""));
    show({ onSave });
    const name = screen.getByLabelText("Loop Name");
    await userEvent.type(name, "s{Enter}");
    expect(await screen.findByText("That name is taken.")).toBeInTheDocument();
    expect(name).toHaveValue("Book Clubs");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Couldn't save that. Try again."),
    ).toBeInTheDocument();
  });

  it("follows a change made elsewhere, unless you are editing that field", async () => {
    const { rerender } = show();
    await userEvent.type(screen.getByLabelText("Description"), "!");
    rerender(
      <LoopDetailsForm
        name="Readers"
        description="Changed by another admin."
        imageUrl={null}
        canEdit
      />,
    );
    expect(screen.getByLabelText("Loop Name")).toHaveValue("Readers");
    expect(screen.getByLabelText("Description")).toHaveValue("We read.!");
  });

  it("does not submit when nothing has changed, or with nobody listening", async () => {
    const { onSave } = show();
    fireEvent.submit(screen.getByLabelText("Loop Name").closest("form")!);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("copes with no save handler", async () => {
    show({ onSave: undefined });
    await userEvent.type(screen.getByLabelText("Loop Name"), "s{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
  });
});
