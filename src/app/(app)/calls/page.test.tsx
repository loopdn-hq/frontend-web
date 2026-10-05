import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let calls: Record<string, unknown>;
let shell: { conversations: Record<string, unknown>[]; userProfile: { username?: string } };
let socketListener: ((frame: Record<string, unknown>) => void) | null = null;
const unsubscribe = vi.fn();
const openNavDrawer = vi.fn();

vi.mock("@/lib/calls/CallProvider", () => ({ useCalls: () => calls }));
vi.mock("@/lib/app/AppShellProvider", () => ({
  useAppShell: () => ({
    ...shell,
    openNavDrawer,
    subscribeToSocket: (listener: typeof socketListener) => {
      socketListener = listener;
      return unsubscribe;
    },
  }),
}));
vi.mock("@/lib/calls/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/calls/api")>("@/lib/calls/api");
  return {
    ...actual,
    deleteRecording: vi.fn(),
    fetchCallRecordings: vi.fn(),
    fetchCalls: vi.fn(),
    fetchRecording: vi.fn(),
  };
});

import CallsPage from "@/app/(app)/calls/page";
import {
  CallDetailPanel,
  callDurationSeconds,
} from "@/components/calls/CallDetailPanel";
import {
  deleteRecording,
  fetchCallRecordings,
  fetchCalls,
  fetchRecording,
  normalizeCall,
  type Call,
  type CallRecording,
} from "@/lib/calls/api";
import { deferred } from "@/test/helpers";

const SAM = { id: 7, username: "sam", profile: { display_label: "Sam Wren" } };
const ALEX = { id: 8, username: "alex", profile: { display_label: "Alex Sato" } };

function raw(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    conversation: 12,
    call_type: "audio",
    status: "ended",
    end_reason: "ended",
    created_by: ALEX,
    created_at: "2026-10-05T10:00:00",
    started_at: "2026-10-05T10:00:05",
    ended_at: "2026-10-05T10:02:10",
    participants: [
      { id: 1, user: ALEX, left_at: "2026-10-05T10:02:10", duration: 125 },
      { id: 2, user: SAM, left_at: "2026-10-05T10:02:10", duration: 60 },
    ],
    ...overrides,
  };
}

function call(overrides: Record<string, unknown> = {}): Call {
  return normalizeCall(raw(overrides))!;
}

function recording(overrides: Partial<CallRecording> = {}): CallRecording {
  return {
    id: 5,
    callId: 31,
    status: "completed",
    startedBy: { id: "8", username: "alex", name: "Alex Sato" },
    startedAt: "2026-10-05T10:00:10",
    endedAt: "2026-10-05T10:02:00",
    durationSeconds: 110,
    sizeBytes: 3 * 1024 * 1024,
    contentType: "audio/ogg",
    expiresAt: "2026-11-05T10:02:00",
    deletedAt: null,
    downloadUrl: null,
    ...overrides,
  };
}

function recordingsAre(recordings: CallRecording[]) {
  vi.mocked(fetchCallRecordings).mockResolvedValue({ ok: true, recordings });
}

function callsAre(rows: Call[], hasMore = false) {
  vi.mocked(fetchCalls).mockResolvedValue({ ok: true, calls: rows, hasMore });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  socketListener = null;
  shell = {
    userProfile: { username: "sam" },
    conversations: [
      { id: 12, kind: "group", name: "Book club", isAdmin: false },
      { id: 20, kind: "direct", name: "Alex Sato", isAdmin: false },
    ],
  };
  calls = {
    phase: "idle",
    activeCall: null,
    startCall: vi.fn(async () => {}),
    joinCall: vi.fn(async () => {}),
  };
  recordingsAre([]);
  callsAre([]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("callDurationSeconds", () => {
  it("is the time between starting and ending, or nothing without both", () => {
    expect(callDurationSeconds(call())).toBe(125);
    expect(callDurationSeconds(call({ started_at: null }))).toBeNull();
    expect(callDurationSeconds(call({ ended_at: null }))).toBeNull();
    expect(callDurationSeconds(call({ ended_at: "whenever" }))).toBeNull();
  });
});

describe("CallDetailPanel", () => {
  const onBack = vi.fn();

  function show(target: Call = call()) {
    return render(<CallDetailPanel call={target} title="Book club" onBack={onBack} />);
  }

  it("says what the call was, how long it lasted, and who was on it", async () => {
    show();
    expect(screen.getByRole("heading", { name: "Book club" })).toBeInTheDocument();
    expect(screen.getByText(/Voice call -/)).toBeInTheDocument();
    expect(screen.getByText(/Lasted 2:05 - started by Alex Sato/)).toBeInTheDocument();
    expect(screen.getByText("Alex Sato").closest("li")).toHaveTextContent("2:05");
    expect(screen.getByText("Sam Wren").closest("li")).toHaveTextContent("1:00");
    expect(await screen.findByText("This call wasn't recorded.")).toBeInTheDocument();

    click("Calls");
    expect(onBack).toHaveBeenCalled();
  });

  it("adds up somebody's time across several stays", () => {
    show(
      call({
        participants: [
          { id: 1, user: SAM, left_at: "2026-10-05T10:01:00", duration: 30 },
          { id: 2, user: SAM, left_at: "2026-10-05T10:02:00", duration: 45 },
          { id: 3, user: ALEX, left_at: null },
        ],
      }),
    );
    expect(screen.getByText("Sam Wren").closest("li")).toHaveTextContent("1:15");
    expect(screen.getByText("Alex Sato").closest("li")).toHaveTextContent("In the call");
  });

  it.each([
    [{ started_at: null, end_reason: "declined" }, /Declined/],
    [{ started_at: null, end_reason: "unanswered" }, /Not answered/],
  ])("describes a call that never connected: %j", (overrides, text) => {
    show(call({ ...overrides, participants: [], created_by: null }));
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText("Nobody joined.")).toBeInTheDocument();
    expect(screen.queryByText(/started by/)).not.toBeInTheDocument();
  });

  it("offers to call again, by the same kind of call", () => {
    show(call({ call_type: "video" }));
    expect(screen.getByText(/Video call -/)).toBeInTheDocument();
    click("Call again");
    expect(calls.startCall).toHaveBeenCalledWith(12, "video");
  });

  it("offers to join a call still in progress", () => {
    show(call({ status: "active", ended_at: null }));
    expect(screen.getByText(/In progress/)).toBeInTheDocument();
    click("Join");
    expect(calls.joinCall).toHaveBeenCalledWith(31);
  });

  it("says you are already in it, and waits while another call connects", () => {
    calls = { ...calls, activeCall: call({ status: "active" }) };
    const current = show(call({ status: "active", ended_at: null }));
    expect(screen.getByRole("button", { name: "You're in this call" })).toBeDisabled();
    current.unmount();

    calls = { ...calls, activeCall: null, phase: "joining" };
    show();
    expect(screen.getByRole("button", { name: "Call again" })).toBeDisabled();
  });

  it("lists each recording with its state, length, size and expiry", async () => {
    recordingsAre([
      recording(),
      recording({ id: 6, status: "recording", durationSeconds: null, startedBy: null }),
      recording({ id: 7, status: "failed", sizeBytes: 500, expiresAt: null }),
      recording({ id: 8, status: "completed", sizeBytes: 2048, expiresAt: null }),
    ]);
    show();
    const ready = (await screen.findAllByText(/Ready/))[0].closest("li")!;
    expect(ready).toHaveTextContent("Ready - 1:50");
    expect(ready).toHaveTextContent("Started by Alex Sato - 3.0 MB - kept until");
    expect(screen.getByText("Recording now").closest("li")).toHaveTextContent("Recording");
    expect(screen.getAllByRole("button", { name: "Download recording" })).toHaveLength(2);
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    // Deleting is for whoever runs the call; this account does not.
    expect(screen.queryByRole("button", { name: "Delete recording" })).not.toBeInTheDocument();
  });

  it("opens a recording's download link in a new tab", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    recordingsAre([recording()]);
    const pending = deferred<Awaited<ReturnType<typeof fetchRecording>>>();
    vi.mocked(fetchRecording).mockReturnValue(pending.promise);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Download recording" }));
    expect(screen.getByRole("button", { name: "Download recording" })).toBeDisabled();

    await act(async () =>
      pending.resolve({
        ok: true,
        recording: recording({ downloadUrl: "https://cdn.example/rec.ogg" }),
      }),
    );
    expect(fetchRecording).toHaveBeenCalledWith(5);
    expect(open).toHaveBeenCalledWith(
      "https://cdn.example/rec.ogg",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("says when a recording cannot be downloaded", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    recordingsAre([recording()]);
    vi.mocked(fetchRecording).mockResolvedValue({ ok: true, recording: recording() });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Download recording" }));
    expect(
      await screen.findByText("This recording isn't ready to download yet."),
    ).toBeInTheDocument();

    vi.mocked(fetchRecording).mockResolvedValue({
      ok: false,
      message: "Unable to load the recording.",
    });
    click("Download recording");
    expect(await screen.findByText("Unable to load the recording.")).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it("lets whoever started the call delete a recording, after asking", async () => {
    recordingsAre([recording()]);
    const pending = deferred<Awaited<ReturnType<typeof deleteRecording>>>();
    vi.mocked(deleteRecording).mockReturnValue(pending.promise);
    show(call({ created_by: SAM }));

    fireEvent.click(await screen.findByRole("button", { name: "Delete recording" }));
    const dialog = within(screen.getByRole("dialog", { name: "Delete this recording?" }));
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    click("Delete recording");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Deleting..." }),
    ).toBeDisabled();

    await act(async () => pending.resolve({ ok: true }));
    expect(deleteRecording).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // It stays in the history, marked as deleted, with nothing left to do to it.
    expect(screen.getByText(/Deleted/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download recording" })).not.toBeInTheDocument();
  });

  it("lets a group admin, or either side of a direct call, delete too", async () => {
    recordingsAre([recording({ status: "failed" })]);
    shell.conversations = [{ id: 12, kind: "group", name: "Book club", isAdmin: true }];
    const admin = show();
    expect(await screen.findByRole("button", { name: "Delete recording" })).toBeInTheDocument();
    admin.unmount();

    shell.conversations = [{ id: 12, kind: "direct", name: "Alex", isAdmin: false }];
    shell.userProfile = {};
    show();
    expect(await screen.findByRole("button", { name: "Delete recording" })).toBeInTheDocument();
  });

  it("says why a recording could not be deleted", async () => {
    recordingsAre([recording()]);
    vi.mocked(deleteRecording).mockResolvedValue({
      ok: false,
      message: "Unable to delete the recording.",
    });
    show(call({ created_by: SAM }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete recording" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }),
    );
    expect(await screen.findByText("Unable to delete the recording.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Ready/)).toBeInTheDocument();

    click("Delete recording");
    click("Close modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides the section where recordings do not exist, and retries a failed load", async () => {
    vi.mocked(fetchCallRecordings).mockResolvedValue({
      ok: false,
      message: "Not found.",
      status: 404,
    });
    const hidden = show();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Recordings" })).not.toBeInTheDocument(),
    );
    hidden.unmount();

    vi.mocked(fetchCallRecordings).mockResolvedValue({
      ok: false,
      message: "Unable to load recordings.",
      status: 500,
    });
    show();
    expect(await screen.findByText("Unable to load recordings.")).toBeInTheDocument();

    recordingsAre([]);
    click("Retry");
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(await screen.findByText("This call wasn't recorded.")).toBeInTheDocument();
  });

  it("ignores recordings that arrive after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCallRecordings>>>();
    vi.mocked(fetchCallRecordings).mockReturnValue(pending.promise);
    const { unmount } = show();
    unmount();
    pending.resolve({ ok: true, recordings: [] });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("CallsPage", () => {
  function rows() {
    return screen.getAllByRole("button", { current: false }).filter((button) =>
      button.hasAttribute("aria-current"),
    );
  }

  function rowFor(title: string, index = 0) {
    return screen
      .getAllByText(title)
      .map((element) => element.closest("button")!)
      .filter(Boolean)[index];
  }

  it("shows a placeholder, then that there are no calls yet", async () => {
    render(<CallsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your activity");
    expect(await screen.findByText("No calls yet")).toBeInTheDocument();
    expect(
      screen.getByText("Select a call to see who was on it and any recordings."),
    ).toBeInTheDocument();
    click("Open navigation");
    expect(openNavDrawer).toHaveBeenCalled();
  });

  it("groups calls by day, and says how each one went for this account", async () => {
    callsAre([
      // Answered: this account was on it.
      call({ id: 1 }),
      // Started by this account, and nobody picked up.
      call({ id: 2, created_by: SAM, started_at: null, ended_at: null, participants: [], end_reason: "unanswered" }),
      // Went ahead without this account.
      call({ id: 3, conversation: 20, call_type: "video", participants: [{ id: 1, user: ALEX, left_at: "x", duration: 5 }] }),
      // Declined.
      call({ id: 4, started_at: null, participants: [], end_reason: "declined" }),
      // Still going.
      call({ id: 5, status: "active", ended_at: null }),
      // Yesterday, started by this account and answered.
      call({ id: 6, created_by: SAM, created_at: "2026-10-04T09:00:00" }),
      // From somewhere this account can no longer see.
      call({ id: 7, conversation: 999, created_at: "2026-09-01T09:00:00" }),
    ]);
    render(<CallsPage />);
    await screen.findByText("Today");
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(rows()).toHaveLength(7);

    const answered = rowFor("Book club", 0);
    expect(answered).toHaveTextContent("2:05");
    expect(within(answered).getByLabelText("Answered, incoming")).toBeInTheDocument();

    expect(rowFor("Book club", 1)).toHaveTextContent("No answer");
    expect(within(rowFor("Book club", 1)).getByLabelText("No answer")).toBeInTheDocument();

    const missed = rowFor("Alex Sato");
    expect(missed).toHaveTextContent("Missed");
    expect(within(missed).getByLabelText("Missed")).toBeInTheDocument();

    expect(rowFor("Book club", 2)).toHaveTextContent("Declined");
    expect(rowFor("Book club", 3)).toHaveTextContent("In progress");
    expect(within(rowFor("Book club", 3)).getByLabelText("In progress")).toBeInTheDocument();
    expect(within(rowFor("Book club", 4)).getByLabelText("Answered, outgoing")).toBeInTheDocument();
    expect(rowFor("Conversation")).toBeInTheDocument();
  });

  it("opens a call beside the list, and closes it again", async () => {
    callsAre([call()]);
    render(<CallsPage />);
    fireEvent.click(await screen.findByText("Book club"));
    expect(screen.getByRole("heading", { name: "Book club" })).toBeInTheDocument();
    expect(rowFor("Book club")).toHaveAttribute("aria-current", "true");

    click("Calls");
    expect(screen.queryByRole("heading", { name: "Book club" })).not.toBeInTheDocument();
  });

  it("puts a new call at the top, and updates one already listed", async () => {
    callsAre([call({ id: 1, status: "active", ended_at: null })]);
    render(<CallsPage />);
    await screen.findByText("In progress");

    act(() => socketListener!({ type: "call.ended", call: raw({ id: 1 }) }));
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(1);

    act(() =>
      socketListener!({
        type: "call.incoming",
        call: raw({ id: 9, conversation: 20, status: "ringing", ended_at: null }),
      }),
    );
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Alex Sato");

    act(() => socketListener!({ type: "message.new" }));
    expect(rows()).toHaveLength(2);
  });

  it("loads older calls onto the end, without repeating one", async () => {
    callsAre([call({ id: 1 })], true);
    render(<CallsPage />);
    await screen.findByText("Book club");

    const older = deferred<Awaited<ReturnType<typeof fetchCalls>>>();
    vi.mocked(fetchCalls).mockReturnValue(older.promise);
    click("Load older calls");
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    expect(fetchCalls).toHaveBeenLastCalledWith({ page: 2 });

    await act(async () =>
      older.resolve({
        ok: true,
        hasMore: false,
        calls: [call({ id: 1 }), call({ id: 2, conversation: 20 })],
      }),
    );
    expect(rows()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load older calls" })).not.toBeInTheDocument();
  });

  it("keeps the list and says why older calls could not be loaded", async () => {
    callsAre([call({ id: 1 })], true);
    render(<CallsPage />);
    await screen.findByText("Book club");
    vi.mocked(fetchCalls).mockResolvedValue({ ok: false, message: "Lost connection." });
    click("Load older calls");
    expect(await screen.findByText("Lost connection.")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it("offers a retry when the calls cannot be loaded at all", async () => {
    vi.mocked(fetchCalls).mockResolvedValue({
      ok: false,
      message: "Unable to load your calls.",
    });
    render(<CallsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your calls.");

    callsAre([call()]);
    click(/try again/i);
    expect(await screen.findByText("Book club")).toBeInTheDocument();
  });

  it("treats every call as incoming until it knows who is signed in", async () => {
    shell.userProfile = {};
    callsAre([call({ created_by: SAM })]);
    render(<CallsPage />);
    const row = (await screen.findByText("Book club")).closest("button")!;
    expect(within(row).getByLabelText("Missed")).toBeInTheDocument();
  });

  it("stops listening, and ignores a late list, once it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCalls>>>();
    vi.mocked(fetchCalls).mockReturnValue(pending.promise);
    const { unmount } = render(<CallsPage />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
    pending.resolve({ ok: true, calls: [], hasMore: false });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
