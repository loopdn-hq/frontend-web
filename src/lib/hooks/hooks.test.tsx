import { act, render, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function pointerDown(target: EventTarget) {
  // jsdom has no PointerEvent constructor; the hook only reads `target`.
  target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

describe("useClickOutside", () => {
  function Menu({
    active,
    onOutside,
  }: {
    active: boolean;
    onOutside: () => void;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, active, onOutside);
    return (
      <>
        <div ref={ref} data-testid="menu">
          <button data-testid="inside">Inside</button>
        </div>
        <button data-testid="outside">Outside</button>
        <button data-testid="trigger" data-ignore-click-outside>
          <span data-testid="trigger-icon" />
        </button>
      </>
    );
  }

  it("fires for a press outside, and not for one inside", () => {
    const onOutside = vi.fn();
    const view = render(<Menu active onOutside={onOutside} />);

    pointerDown(view.getByTestId("inside"));
    expect(onOutside).not.toHaveBeenCalled();

    pointerDown(view.getByTestId("outside"));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("leaves the menu's own trigger alone, so it can close its own menu", () => {
    const onOutside = vi.fn();
    const view = render(<Menu active onOutside={onOutside} />);
    pointerDown(view.getByTestId("trigger-icon"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("hears a press even when a child stops it from bubbling", () => {
    const onOutside = vi.fn();
    const view = render(<Menu active onOutside={onOutside} />);
    const outside = view.getByTestId("outside");
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());
    pointerDown(outside);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("ignores a press on something that is not a node", () => {
    const onOutside = vi.fn();
    render(<Menu active onOutside={onOutside} />);
    pointerDown(document);
    // The document is a Node outside the menu, so this one does count...
    expect(onOutside).toHaveBeenCalledTimes(1);
    // ...and the window is not a Node, so this one does not.
    pointerDown(window);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("listens only while active, and stops on unmount", () => {
    const onOutside = vi.fn();
    const view = render(<Menu active={false} onOutside={onOutside} />);
    pointerDown(view.getByTestId("outside"));
    expect(onOutside).not.toHaveBeenCalled();

    view.rerender(<Menu active onOutside={onOutside} />);
    view.unmount();
    pointerDown(document.body);
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("does nothing when the ref points at nothing", () => {
    const onOutside = vi.fn();
    renderHook(() => useClickOutside({ current: null }, true, onOutside));
    pointerDown(document.body);
    expect(onOutside).not.toHaveBeenCalled();
  });
});

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function withClipboard(writeText: unknown) {
    vi.stubGlobal("navigator", { clipboard: writeText ? { writeText } : {} });
  }

  it("copies, says so, and stops saying so after a moment", async () => {
    const writeText = vi.fn(async () => {});
    withClipboard(writeText);
    const { result } = renderHook(() => useCopyToClipboard(500));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("join-code");
    });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("join-code");
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBe("");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("restarts the moment when something is copied twice", async () => {
    withClipboard(vi.fn(async () => {}));
    const { result } = renderHook(() => useCopyToClipboard(500));

    await act(async () => {
      await result.current.copy("one");
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    await act(async () => {
      await result.current.copy("two");
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.copied).toBe(true);
  });

  it("reports a refusal instead of throwing", async () => {
    withClipboard(
      vi.fn(async () => {
        throw new Error("denied");
      }),
    );
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("x");
    });
    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe("Could not copy that.");
  });

  it("says so where there is no clipboard at all", async () => {
    withClipboard(null);
    const { result } = renderHook(() => useCopyToClipboard());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("x");
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe(
      "Copying is not available in this browser.",
    );
  });

  it("drops its timer when unmounted mid-acknowledgement", async () => {
    withClipboard(vi.fn(async () => {}));
    const { result, unmount } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("x");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDebouncedValue", () => {
  it("holds the old value until typing pauses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: "a" } },
    );
    expect(result.current).toBe("a");

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("abc");
  });

  it("waits 300ms unless told otherwise", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 1 } },
    );
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });
});

describe("useEscapeKey", () => {
  function press(key: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  }

  it("runs on Escape, only while active", () => {
    const onEscape = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ active }) => useEscapeKey(active, onEscape),
      { initialProps: { active: false } },
    );
    press("Escape");
    expect(onEscape).not.toHaveBeenCalled();

    rerender({ active: true });
    press("Enter");
    expect(onEscape).not.toHaveBeenCalled();
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);

    unmount();
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe("useReturnFocus", () => {
  it("puts focus back where it was when the thing closes", () => {
    const trigger = document.createElement("button");
    const elsewhere = document.createElement("button");
    document.body.append(trigger, elsewhere);
    trigger.focus();

    const { rerender } = renderHook(({ active }) => useReturnFocus(active), {
      initialProps: { active: true },
    });
    elsewhere.focus();
    rerender({ active: false });
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    elsewhere.remove();
  });

  it("does not chase something that has since been removed", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = renderHook(() => useReturnFocus(true));
    trigger.remove();
    expect(() => unmount()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it("remembers nothing while inactive", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const focus = vi.spyOn(trigger, "focus");
    const { unmount } = renderHook(() => useReturnFocus(false));
    unmount();
    expect(focus).not.toHaveBeenCalled();
    trigger.remove();
  });
});
