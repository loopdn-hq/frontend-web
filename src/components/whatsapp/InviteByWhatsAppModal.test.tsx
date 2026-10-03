import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/whatsapp/api", () => ({
  inviteByWhatsApp: vi.fn(),
  fetchConnections: vi.fn(),
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

import { InviteByWhatsAppModal } from "@/components/whatsapp/InviteByWhatsAppModal";
import { fetchConnections, inviteByWhatsApp } from "@/lib/whatsapp/api";
import type { InviteResult, WhatsAppConnection } from "@/lib/whatsapp/types";

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

function open(
  props: Partial<Parameters<typeof InviteByWhatsAppModal>[0]> = {},
) {
  return render(
    <InviteByWhatsAppModal
      isOpen
      onClose={vi.fn()}
      conversationId={9}
      {...props}
    />,
  );
}

async function fillNewPerson() {
  await userEvent.type(screen.getByLabelText(/^phone number$/i), "5550001111");
  await userEvent.type(screen.getByLabelText(/their name/i), "Sam");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InviteByWhatsAppModal", () => {
  it("requires a name, because a number alone shows the group a bare number", async () => {
    open();
    await userEvent.type(
      screen.getByLabelText(/^phone number$/i),
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
    expect(
      screen.queryByRole("radio", { name: /someone in the group/i }),
    ).not.toBeInTheDocument();

    open({ members, canInviteMembers: true });
    expect(
      screen.getAllByRole("radio", { name: /someone in the group/i })[0],
    ).toBeInTheDocument();
  });
});
