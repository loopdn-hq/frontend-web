import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let configState: { config: unknown; isLoading: boolean; isEnabled: boolean };
let connectState: { isConnecting: boolean; error: string | null };
const connect = vi.fn();

vi.mock("@/lib/whatsapp/useWhatsAppConfig", () => ({
  useWhatsAppConfig: () => configState,
}));
vi.mock("@/lib/whatsapp/useWhatsAppConnect", () => ({
  useWhatsAppConnect: () => ({ connect, ...connectState }),
}));
vi.mock("@/lib/whatsapp/api", () => ({
  disconnectConnection: vi.fn(),
  fetchConnections: vi.fn(),
  refreshConnection: vi.fn(),
  updateConnectionTemplates: vi.fn(),
}));

import { WhatsAppSettingsSection } from "@/components/whatsapp/WhatsAppSettingsSection";
import {
  disconnectConnection,
  fetchConnections,
  refreshConnection,
  updateConnectionTemplates,
} from "@/lib/whatsapp/api";
import type { WhatsAppConnection } from "@/lib/whatsapp/types";
import { deferred } from "@/test/helpers";

function connection(overrides: Partial<WhatsAppConnection> = {}): WhatsAppConnection {
  return {
    id: 3,
    status: "active",
    wabaId: "w1",
    phoneNumberId: "p1",
    displayPhoneNumber: "+1 555 000 1111",
    verifiedName: "Acme",
    qualityRating: "GREEN",
    messagingLimitTier: "TIER_1K",
    notificationTemplateName: "group_message",
    notificationTemplateLanguage: "en_US",
    invitationTemplateName: "group_invitation",
    lastError: "",
    connectedAt: "2026-09-01T10:00:00Z",
    groups: [{ id: 9, name: "Team", keyword: "team" }],
    ...overrides,
  };
}

function connectionsAre(rows: WhatsAppConnection[]) {
  vi.mocked(fetchConnections).mockResolvedValue({ ok: true, data: rows });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  configState = { config: { enabled: true }, isLoading: false, isEnabled: true };
  connectState = { isConnecting: false, error: null };
  connectionsAre([]);
});

describe("WhatsAppSettingsSection", () => {
  it("shows nothing while the config loads, or when the feature is off", () => {
    configState = { config: null, isLoading: true, isEnabled: false };
    const loading = render(<WhatsAppSettingsSection />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    configState = { config: { enabled: false }, isLoading: false, isEnabled: false };
    const off = render(<WhatsAppSettingsSection />);
    expect(off.container).toBeEmptyDOMElement();
    expect(fetchConnections).not.toHaveBeenCalled();
  });

  it("offers to connect when no number is connected yet", async () => {
    render(<WhatsAppSettingsSection />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(
      await screen.findByText("No WhatsApp number is connected yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect WhatsApp Business" }),
    ).toBeEnabled();
  });

  it("connects a number, says so, and lists it", async () => {
    connect.mockResolvedValue(connection());
    render(<WhatsAppSettingsSection />);
    await screen.findByText("No WhatsApp number is connected yet.");

    connectionsAre([connection()]);
    click("Connect WhatsApp Business");
    expect(await screen.findByText("Acme is connected.")).toBeInTheDocument();
    expect(await screen.findByText("+1 555 000 1111")).toBeInTheDocument();
    expect(fetchConnections).toHaveBeenCalledTimes(2);
  });

  it("names a connection generically when Meta gave it no name", async () => {
    connect.mockResolvedValue(connection({ verifiedName: "" }));
    render(<WhatsAppSettingsSection />);
    await screen.findByText("No WhatsApp number is connected yet.");
    click("Connect WhatsApp Business");
    expect(
      await screen.findByText("WhatsApp Business is connected."),
    ).toBeInTheDocument();
  });

  it("does nothing more when the connect flow is cancelled", async () => {
    connect.mockResolvedValue(null);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("No WhatsApp number is connected yet.");
    click("Connect WhatsApp Business");
    await waitFor(() => expect(connect).toHaveBeenCalled());
    expect(fetchConnections).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/is connected\./)).not.toBeInTheDocument();
  });

  it("shows the connect flow's own progress and error", async () => {
    connectState = { isConnecting: true, error: "Facebook was blocked." };
    render(<WhatsAppSettingsSection />);
    expect(await screen.findByRole("button", { name: "Connecting..." })).toBeDisabled();
    expect(screen.getByText("Facebook was blocked.")).toBeInTheDocument();
  });

  it("reports a failed load as an empty list with the reason", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({
      ok: false,
      message: "WhatsApp is unavailable right now.",
    } as never);
    render(<WhatsAppSettingsSection />);
    expect(
      await screen.findByText("WhatsApp is unavailable right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("No WhatsApp number is connected yet.")).toBeInTheDocument();
  });

  it("describes each connected number and the groups using it", async () => {
    connectionsAre([
      connection(),
      connection({
        id: 4,
        verifiedName: "",
        status: "error",
        lastError: "The token expired.",
        qualityRating: "",
        messagingLimitTier: "",
        groups: [],
      }),
      connection({
        id: 5,
        verifiedName: "Globex",
        status: "suspended",
        groups: [{ id: 2, name: "Sales", keyword: "" }],
      }),
    ]);
    render(<WhatsAppSettingsSection />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Suspended by Meta")).toBeInTheDocument();
    expect(screen.getByText("The token expired.")).toBeInTheDocument();
    expect(screen.getByText("#team")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
    expect(
      screen.getByText("None yet. Add it from a group's WhatsApp settings."),
    ).toBeInTheDocument();
    // Only the broken one offers to reconnect.
    expect(screen.getAllByRole("button", { name: "Reconnect" })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Connect another number" }),
    ).toBeEnabled();
  });

  it("reconnects a broken number through the same flow", async () => {
    connect.mockResolvedValue(connection());
    connectionsAre([connection({ status: "error" })]);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Needs attention");
    click("Reconnect");
    expect(await screen.findByText("Acme is connected.")).toBeInTheDocument();

    click("Connect another number");
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  });

  it("refreshes one number from WhatsApp, replacing just that row", async () => {
    connectionsAre([connection(), connection({ id: 4, verifiedName: "Globex" })]);
    const pending = deferred<Awaited<ReturnType<typeof refreshConnection>>>();
    vi.mocked(refreshConnection).mockReturnValue(pending.promise);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Globex");

    const [first, second] = screen.getAllByRole("button", { name: "Refresh" });
    fireEvent.click(first);
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();
    expect(refreshConnection).toHaveBeenCalledWith(3);

    await act(async () =>
      pending.resolve({ ok: true, data: connection({ qualityRating: "YELLOW" }) }),
    );
    expect(screen.getByText("YELLOW")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(first).toBeEnabled();
  });

  it("says why a refresh failed", async () => {
    connectionsAre([connection()]);
    vi.mocked(refreshConnection).mockResolvedValue({
      ok: false,
      message: "Couldn't refresh from WhatsApp.",
    } as never);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");
    click("Refresh");
    expect(
      await screen.findByText("Couldn't refresh from WhatsApp."),
    ).toBeInTheDocument();
  });

  it("asks before disconnecting, saying how many groups it will affect", async () => {
    connectionsAre([
      connection({
        groups: [
          { id: 1, name: "One", keyword: "" },
          { id: 2, name: "Two", keyword: "" },
        ],
      }),
    ]);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");

    click("Disconnect");
    const dialog = screen.getByRole("dialog", { name: "Disconnect this number?" });
    expect(dialog).toHaveTextContent("2 groups will stop using WhatsApp.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(disconnectConnection).not.toHaveBeenCalled();

    click("Disconnect");
    click("Close modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disconnects, says so, and reloads the list", async () => {
    connectionsAre([connection()]);
    const pending = deferred<Awaited<ReturnType<typeof disconnectConnection>>>();
    vi.mocked(disconnectConnection).mockReturnValue(pending.promise);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");

    click("Disconnect");
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("1 group will stop using WhatsApp.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    expect(within(dialog).getByRole("button", { name: "Disconnecting..." })).toBeDisabled();

    connectionsAre([]);
    await act(async () => pending.resolve({ ok: true, data: true }));
    expect(disconnectConnection).toHaveBeenCalledWith(3);
    expect(screen.getByText("That number is disconnected.")).toBeInTheDocument();
    expect(
      await screen.findByText("No WhatsApp number is connected yet."),
    ).toBeInTheDocument();
  });

  it("says why a disconnect failed and leaves the number listed", async () => {
    connectionsAre([connection()]);
    vi.mocked(disconnectConnection).mockResolvedValue({
      ok: false,
      message: "Couldn't disconnect that number.",
    } as never);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");
    click("Disconnect");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }),
    );
    expect(
      await screen.findByText("Couldn't disconnect that number."),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(fetchConnections).toHaveBeenCalledTimes(1);
  });

  it("saves the template names for a number", async () => {
    connectionsAre([connection()]);
    const pending = deferred<Awaited<ReturnType<typeof updateConnectionTemplates>>>();
    vi.mocked(updateConnectionTemplates).mockReturnValue(pending.promise);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");

    fireEvent.change(screen.getByPlaceholderText("group_message"), {
      target: { value: "notify_v2" },
    });
    fireEvent.change(screen.getByPlaceholderText("en_US"), {
      target: { value: "en_GB" },
    });
    fireEvent.change(screen.getByPlaceholderText("group_invitation"), {
      target: { value: "invite_v2" },
    });
    click("Save templates");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(updateConnectionTemplates).toHaveBeenCalledWith(3, {
      notificationTemplateName: "notify_v2",
      notificationTemplateLanguage: "en_GB",
      invitationTemplateName: "invite_v2",
    });

    await act(async () =>
      pending.resolve({
        ok: true,
        data: connection({ verifiedName: "Acme Ltd", notificationTemplateName: "notify_v2" }),
      }),
    );
    expect(screen.getByText("Template names saved.")).toBeInTheDocument();
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
  });

  it("says why the template names were refused", async () => {
    connectionsAre([connection()]);
    vi.mocked(updateConnectionTemplates).mockResolvedValue({
      ok: false,
      message: "That template is not approved.",
    } as never);
    render(<WhatsAppSettingsSection />);
    await screen.findByText("Acme");
    click("Save templates");
    expect(
      await screen.findByText("That template is not approved."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Template names saved.")).not.toBeInTheDocument();
  });
});
