import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWebSocket } from "@/lib/websocket/useWebSocket";

/** A socket the test drives by hand: nothing here opens a connection. */
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  static refuse = false;

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  failSend = false;

  constructor(public url: string) {
    if (FakeWebSocket.refuse) throw new Error("Blocked by the browser.");
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }

  send(data: string) {
    if (this.failSend) throw new Error("Buffer full.");
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function socket(index = -1) {
  return FakeWebSocket.instances.at(index)!;
}

/** Mount the hook and let its deferred connect run. */
function connect(options: Partial<Parameters<typeof useWebSocket>[0]> = {}) {
  const view = renderHook(() =>
    useWebSocket({ url: "wss://loopdn.example/ws/", reconnectDelay: 1000, ...options }),
  );
  act(() => {
    vi.advanceTimersByTime(0);
  });
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  FakeWebSocket.refuse = false;
  vi.stubGlobal("WebSocket", FakeWebSocket);
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useWebSocket", () => {
  it("connects, and says so once the socket is open", () => {
    const onConnect = vi.fn();
    const { result } = connect({ onConnect });
    expect(socket().url).toBe("wss://loopdn.example/ws/");
    expect(result.current.status).toBe("connecting");
    expect(result.current.isConnected).toBe(false);

    act(() => socket().open());
    expect(result.current.status).toBe("connected");
    expect(result.current.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("does not connect while disabled or without an address", () => {
    connect({ enabled: false });
    connect({ url: "" });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("hands each frame to the caller, and drops one that is not JSON", () => {
    const onMessage = vi.fn();
    connect({ onMessage });
    act(() => socket().open());

    act(() => socket().receive({ type: "message.new", id: 4 }));
    expect(onMessage).toHaveBeenCalledWith({ type: "message.new", id: 4 });

    act(() => socket().receive("not json"));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("sends a frame as JSON when the socket is open", () => {
    const { result } = connect();
    act(() => socket().open());
    act(() => result.current.send({ type: "typing", conversation: 12 }));
    expect(socket().sent).toEqual(['{"type":"typing","conversation":12}']);
    expect(result.current.error).toBeNull();
  });

  it("reports a frame it could not send", () => {
    const onError = vi.fn();
    const { result } = connect({ onError });

    act(() => result.current.send({ type: "typing" }));
    expect(result.current.error?.message).toBe("WebSocket connection not ready");

    act(() => socket().open());
    socket().failSend = true;
    act(() => result.current.send({ type: "typing" }));
    expect(result.current.error?.message).toBe("Buffer full.");
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("wraps a send failure that is not an Error", () => {
    const { result } = connect();
    act(() => socket().open());
    socket().send = () => {
      throw "nope";
    };
    act(() => result.current.send({ type: "typing" }));
    expect(result.current.error?.message).toBe("Failed to send message");
  });

  it("reports a socket error", () => {
    const onError = vi.fn();
    const { result } = connect({ onError });
    act(() => socket().onerror?.({}));
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("WebSocket error occurred");
    expect(onError).toHaveBeenCalled();
  });

  it("reconnects after a drop, up to its limit", () => {
    const onDisconnect = vi.fn();
    const { result } = connect({ onDisconnect, reconnectAttempts: 2 });
    act(() => socket().open());

    act(() => socket().close());
    expect(result.current.status).toBe("disconnected");
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => socket().close());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);

    // The third drop is past the limit: it stays down.
    act(() => socket().close());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("starts counting again once a reconnect succeeds", () => {
    connect({ reconnectAttempts: 1 });
    act(() => socket().close());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => socket().open());

    act(() => socket().close());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("does not open a second socket while one is open or opening", () => {
    const { result } = connect();
    act(() => result.current.reconnect());
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => socket().open());
    act(() => result.current.reconnect());
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("closes the socket and cancels a pending reconnect on disconnect", () => {
    const { result } = connect({ reconnectAttempts: 0 });
    act(() => socket().open());
    const first = socket();

    act(() => result.current.disconnect());
    expect(first.readyState).toBe(FakeWebSocket.CLOSED);
    expect(result.current.status).toBe("disconnected");

    act(() => result.current.disconnect());
    expect(result.current.status).toBe("disconnected");
  });

  it("closes on unmount without reconnecting", () => {
    const { unmount } = connect();
    act(() => socket().open());
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(socket(0).readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("reports a socket that could not even be created", () => {
    FakeWebSocket.refuse = true;
    const onError = vi.fn();
    const { result } = connect({ onError });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Blocked by the browser.");
    expect(onError).toHaveBeenCalled();
  });

  it("wraps a creation failure that is not an Error", () => {
    vi.stubGlobal(
      "WebSocket",
      Object.assign(
        function Broken() {
          throw "nope";
        },
        { OPEN: 1, CONNECTING: 0 },
      ),
    );
    const { result } = connect();
    expect(result.current.error?.message).toBe("Failed to create WebSocket");
  });
});
