import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/whatsapp/api", () => ({
  fetchGroupWhatsApp: vi.fn(),
  fetchConnections: vi.fn(),
  attachGroupWhatsApp: vi.fn(),
  detachGroupWhatsApp: vi.fn(),
  setGroupWhatsAppConsent: vi.fn(),
}));
vi.mock("@/lib/whatsapp/useWhatsAppConnect", () => ({
  useWhatsAppConnect: () => ({
    connect: vi.fn(),
    reset: vi.fn(),
    phase: "idle",
    error: null,
    isConnecting: false,
  }),
}));

import { GroupWhatsAppPanel } from "@/components/whatsapp/GroupWhatsAppPanel";
import {
  fetchConnections,
  fetchGroupWhatsApp,
  setGroupWhatsAppConsent,
} from "@/lib/whatsapp/api";
import { resetWhatsAppConfigForTests } from "@/lib/whatsapp/useWhatsAppConfig";
import type { ConsentStatus, GroupWhatsAppState } from "@/lib/whatsapp/types";

// The config hook caches per page; each case gets its own answer.
vi.mock("@/lib/whatsapp/useWhatsAppConfig", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/whatsapp/useWhatsAppConfig")
  >("@/lib/whatsapp/useWhatsAppConfig");
  return {
    ...actual,
    useWhatsAppConfig: () => ({
      config: {
        enabled: enabledForTest,
        appId: "a",
        configId: "c",
        graphVersion: "v21.0",
      },
      isLoading: false,
      isEnabled: enabledForTest,
    }),
  };
});

let enabledForTest = true;

const CHANNEL = {
  id: 4,
  keyword: "team",
  displayPhoneNumber: "+1 555 000 1111",
  verifiedName: "Acme",
  connectionStatus: "active" as const,
  deliveryEnabled: true,
  repliesEnabled: true,
  joinLink: "https://wa.me/15550001111?text=START",
};

function state(overrides: Partial<GroupWhatsAppState>): GroupWhatsAppState {
  return {
    connected: true,
    channel: CHANNEL,
    isAdmin: false,
    myConsent: null,
    myNumberVerified: true,
    ...overrides,
  };
}

function givenGroup(value: GroupWhatsAppState) {
  vi.mocked(fetchGroupWhatsApp).mockResolvedValue({ ok: true, data: value });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetWhatsAppConfigForTests();
  enabledForTest = true;
  vi.mocked(fetchConnections).mockResolvedValue({ ok: true, data: [] });
});

describe("GroupWhatsAppPanel", () => {
  it("shows nothing at all when the deployment has no WhatsApp", () => {
    enabledForTest = false;
    givenGroup(state({}));
    const { container } = render(<GroupWhatsAppPanel conversationId={9} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchGroupWhatsApp).not.toHaveBeenCalled();
  });

  it("shows nothing to a member when the group is not on WhatsApp", async () => {
    givenGroup(state({ connected: false, channel: null }));
    const { container } = render(<GroupWhatsAppPanel conversationId={9} />);
    await waitFor(() => expect(fetchGroupWhatsApp).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("offers an admin a way to attach when the group is not on WhatsApp", async () => {
    givenGroup(state({ connected: false, channel: null, isAdmin: true }));
    render(<GroupWhatsAppPanel conversationId={9} />);

    expect(
      await screen.findByRole("button", { name: /connect whatsapp business/i }),
    ).toBeInTheDocument();
  });

  it.each<[ConsentStatus | null, boolean]>([
    [null, false],
    ["pending", false],
    ["opted_in", true],
    ["declined", false],
    ["opted_out", false],
  ])("reflects my_consent %s as a toggle that is %s", async (consent, on) => {
    givenGroup(state({ myConsent: consent }));
    render(<GroupWhatsAppPanel conversationId={9} />);

    const toggle = await screen.findByRole("switch", {
      name: /get this group on whatsapp/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", String(on));
  });

  it("lets somebody who declined turn it back on - it is their choice", async () => {
    givenGroup(state({ myConsent: "declined" }));
    vi.mocked(setGroupWhatsAppConsent).mockResolvedValue({
      ok: true,
      data: state({ myConsent: "opted_in" }),
    });
    render(<GroupWhatsAppPanel conversationId={9} />);

    const toggle = await screen.findByRole("switch", {
      name: /get this group on whatsapp/i,
    });
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle);

    expect(setGroupWhatsAppConsent).toHaveBeenCalledWith(9, true);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  });

  it("asks for phone verification before an unverified member can opt in", async () => {
    const onVerifyPhone = vi.fn();
    givenGroup(state({ myConsent: null, myNumberVerified: false }));
    render(
      <GroupWhatsAppPanel conversationId={9} onVerifyPhone={onVerifyPhone} />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /get this group on whatsapp/i,
    });
    // Disabled rather than failing at the server: they cannot be reached yet.
    expect(toggle).toBeDisabled();
    expect(
      screen.getByText(/verify your phone number first/i),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /verify my number/i }),
    );
    expect(onVerifyPhone).toHaveBeenCalled();
  });

  it("gives an admin the keyword, both toggles and a way off WhatsApp", async () => {
    givenGroup(state({ isAdmin: true, myConsent: "opted_in" }));
    vi.mocked(fetchConnections).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 2,
          groups: [{ id: 9, name: "Team", keyword: "team" }],
        } as never,
      ],
    });
    render(<GroupWhatsAppPanel conversationId={9} />);

    expect(
      await screen.findByRole("switch", {
        name: /send group messages to whatsapp/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /accept replies from whatsapp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /take this group off whatsapp/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("team")).toBeInTheDocument();
  });

  it("offers the one-tap join link", async () => {
    givenGroup(state({}));
    render(<GroupWhatsAppPanel conversationId={9} />);

    const link = await screen.findByRole("link", { name: /open in whatsapp/i });
    expect(link).toHaveAttribute("href", CHANNEL.joinLink);
  });
});
