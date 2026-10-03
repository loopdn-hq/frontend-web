import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/whatsapp/api", () => ({
  inviteByWhatsApp: vi.fn(),
  fetchConnections: vi.fn(),
  fetchGroupWhatsApp: vi.fn(),
}));

const connect = vi.fn();
vi.mock("@/lib/whatsapp/useWhatsAppConnect", () => ({
  useWhatsAppConnect: () => ({
    connect,
    reset: vi.fn(),
    phase: "idle",
    error: null,
    isConnecting: false,
  }),
}));
vi.mock("@/lib/whatsapp/useWhatsAppConfig", () => ({
  useWhatsAppConfig: () => ({
    config: { enabled: true, appId: "a", configId: "c", graphVersion: "v21.0" },
    isLoading: false,
    isEnabled: true,
  }),
  resetWhatsAppConfigForTests: vi.fn(),
}));

import { InviteByWhatsAppForm } from "@/components/whatsapp/InviteByWhatsAppForm";
import {
  fetchConnections,
  fetchGroupWhatsApp,
  inviteByWhatsApp,
} from "@/lib/whatsapp/api";
import type {
  GroupWhatsAppState,
  InviteResult,
  WhatsAppConnection,
} from "@/lib/whatsapp/types";

const NOT_ON_WHATSAPP: GroupWhatsAppState = {
  connected: false,
  channel: null,
  isAdmin: true,
  myConsent: null,
  myNumberVerified: true,
};

const INVITED: InviteResult = {
  outcome: "invited",
  participant: 5,
  channel: null,
  deliveryStatus: "sent",
  reason: "",
};

function refusal(reason: string, message: string) {
  return {
    ok: false as const,
    message,
    reason: reason as never,
    status: 400,
    retryable: false,
    rateLimited: false,
  };
}

function open(props: Partial<Parameters<typeof InviteByWhatsAppForm>[0]> = {}) {
  return render(
    <InviteByWhatsAppForm onClose={vi.fn()} conversationId={9} {...props} />,
  );
}

// find, not get: the form waits on the check for a number to send from.
async function fillNewPerson() {
  await userEvent.type(
    await screen.findByLabelText(/^phone number$/i),
    "5550001111",
  );
  await userEvent.type(screen.getByLabelText(/their name/i), "Sam");
}

beforeEach(() => {
  vi.clearAllMocks();
  // Somebody with a number of their own, so the form is what opens.
  vi.mocked(fetchConnections).mockResolvedValue({
    ok: true,
    data: [{ id: 3 } as WhatsAppConnection],
  });
  vi.mocked(fetchGroupWhatsApp).mockResolvedValue({
    ok: true,
    data: NOT_ON_WHATSAPP,
  });
});

describe("InviteByWhatsAppForm", () => {
  it("asks to connect first when there is no number to send from", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(inviteByWhatsApp).mockResolvedValue({ ok: true, data: INVITED });
    connect.mockResolvedValue({ id: 7 } as WhatsAppConnection);

    open();
    const connectButton = await screen.findByRole("button", {
      name: /connect whatsapp business/i,
    });
    expect(screen.queryByLabelText(/^phone number$/i)).not.toBeInTheDocument();
    await userEvent.click(connectButton);

    // Connected: the form appears, and sends from the number just connected.
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => expect(inviteByWhatsApp).toHaveBeenCalledTimes(1));
    expect(vi.mocked(inviteByWhatsApp).mock.calls[0][1]).toMatchObject({
      connection: 7,
    });
  });

  it("stays on connect when the person cancels the connect flow", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({ ok: true, data: [] });
    connect.mockResolvedValue(null);

    open();
    await userEvent.click(
      await screen.findByRole("button", { name: /connect whatsapp business/i }),
    );

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(/^phone number$/i)).not.toBeInTheDocument();
  });

  it("skips connect in a group already on somebody else's number", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(fetchGroupWhatsApp).mockResolvedValue({
      ok: true,
      data: { ...NOT_ON_WHATSAPP, connected: true },
    });

    open();
    expect(await screen.findByLabelText(/^phone number$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect whatsapp business/i }),
    ).not.toBeInTheDocument();
  });

  it("requires a name, because a number alone shows the group a bare number", async () => {
    open();
    await userEvent.type(
      await screen.findByLabelText(/^phone number$/i),
      "5550001111",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    expect(await screen.findByText(/a name is required/i)).toBeInTheDocument();
    expect(inviteByWhatsApp).not.toHaveBeenCalled();
  });

  it("connects and then retries the SAME invitation on whatsapp_not_connected", async () => {
    vi.mocked(inviteByWhatsApp)
      .mockResolvedValueOnce(
        refusal("whatsapp_not_connected", "Connect WhatsApp Business first."),
      )
      .mockResolvedValueOnce({ ok: true, data: INVITED });
    connect.mockResolvedValue({ id: 3 } as WhatsAppConnection);

    open();
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(inviteByWhatsApp).toHaveBeenCalledTimes(2));

    // The retry carries the same person AND the number just connected, so the
    // person does not have to type anything again.
    expect(vi.mocked(inviteByWhatsApp).mock.calls[1][1]).toMatchObject({
      displayName: "Sam",
      connection: 3,
    });
    expect(await screen.findByText(/invitation sent/i)).toBeInTheDocument();
  });

  it("does not retry when the person cancels the connect flow", async () => {
    vi.mocked(inviteByWhatsApp).mockResolvedValue(
      refusal("whatsapp_not_connected", "Connect WhatsApp Business first."),
    );
    connect.mockResolvedValue(null);

    open();
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(inviteByWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("asks which number on choose_connection, then sends from it", async () => {
    vi.mocked(inviteByWhatsApp)
      .mockResolvedValueOnce(
        refusal("choose_connection", "Which number should this come from?"),
      )
      .mockResolvedValueOnce({ ok: true, data: INVITED });
    vi.mocked(fetchConnections).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 11,
          displayPhoneNumber: "+1 555 000 1111",
          verifiedName: "Acme",
        } as WhatsAppConnection,
      ],
    });

    open();
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    const picker = await screen.findByRole("combobox");
    expect(picker).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /send from this number/i }),
    );

    await waitFor(() => expect(inviteByWhatsApp).toHaveBeenCalledTimes(2));
    expect(vi.mocked(inviteByWhatsApp).mock.calls[1][1]).toMatchObject({
      connection: 11,
    });
  });

  it("shows the reason when the invitation could not be delivered", async () => {
    vi.mocked(inviteByWhatsApp).mockResolvedValue({
      ok: true,
      data: {
        ...INVITED,
        outcome: "not_sent",
        reason: "No invitation template is configured.",
      },
    });

    open();
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    expect(
      await screen.findByText(/no invitation template is configured/i),
    ).toBeInTheDocument();
  });

  it("reports a rate limit instead of retrying", async () => {
    vi.mocked(inviteByWhatsApp).mockResolvedValue({
      ok: false,
      message: "Too many invitations. Try again shortly.",
      reason: null,
      status: 429,
      retryable: false,
      rateLimited: true,
    });

    open();
    await fillNewPerson();
    await userEvent.click(
      screen.getByRole("button", { name: /send invitation/i }),
    );

    expect(
      await screen.findByText(/too many invitations/i),
    ).toBeInTheDocument();
    expect(inviteByWhatsApp).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it("offers the member picker only to an admin", async () => {
    const members = [{ id: "5", name: "Sam", role: "member" } as never];
    open({ members, canInviteMembers: false });
    await screen.findByLabelText(/^phone number$/i);
    expect(
      screen.queryByRole("radio", { name: /someone in the group/i }),
    ).not.toBeInTheDocument();

    open({ members, canInviteMembers: true });
    expect(
      (
        await screen.findAllByRole("radio", { name: /someone in the group/i })
      )[0],
    ).toBeInTheDocument();
  });
});
